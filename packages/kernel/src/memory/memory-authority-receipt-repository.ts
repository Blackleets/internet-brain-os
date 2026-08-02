import { createHash } from 'node:crypto';
import type {
  MemoryApprovalDecision,
  MemoryAuthorityActor,
  MemoryAuthorityState,
} from './memory-authority-lifecycle';

export interface MemoryAuthorityReceiptPayload {
  readonly memoryId: string;
  readonly from: MemoryAuthorityState;
  readonly to: MemoryAuthorityState;
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly executor: MemoryAuthorityActor;
  readonly policyVersion: string;
  readonly approvalDecisions?: readonly MemoryApprovalDecision[];
  readonly evidenceIds?: readonly string[];
  readonly contradictionDecisionIds?: readonly string[];
  readonly admissionRecordIds?: readonly string[];
  readonly replacementMemoryId?: string;
  readonly reasonCode: string;
  readonly reason: string;
}

export interface MemoryAuthorityTransitionReceipt extends MemoryAuthorityReceiptPayload {
  readonly receiptId: string;
  readonly resultingRevision: number;
  readonly occurredAt: string;
  readonly payloadDigest: string;
  readonly integrityDigest: string;
}

export type MemoryAuthorityReceiptAppendResult =
  | { readonly kind: 'appended'; readonly receipt: MemoryAuthorityTransitionReceipt }
  | { readonly kind: 'replayed'; readonly receipt: MemoryAuthorityTransitionReceipt };

export class MemoryAuthorityReceiptConflictError extends Error {
  constructor(
    readonly code:
      | 'ALTERED_REPLAY'
      | 'REVISION_CONFLICT'
      | 'STATE_CONFLICT'
      | 'INVALID_REVISION'
      | 'INVALID_INPUT',
    message: string,
  ) {
    super(message);
    this.name = 'MemoryAuthorityReceiptConflictError';
  }
}

export interface MemoryAuthorityReceiptRepository {
  append(payload: MemoryAuthorityReceiptPayload, occurredAt: string): MemoryAuthorityReceiptAppendResult;
  list(memoryId: string): readonly MemoryAuthorityTransitionReceipt[];
  findByRequestId(requestId: string): MemoryAuthorityTransitionReceipt | undefined;
}

export class InMemoryMemoryAuthorityReceiptRepository implements MemoryAuthorityReceiptRepository {
  private readonly receiptsByMemory = new Map<string, MemoryAuthorityTransitionReceipt[]>();
  private readonly receiptsByRequest = new Map<string, MemoryAuthorityTransitionReceipt>();

  append(payload: MemoryAuthorityReceiptPayload, occurredAt: string): MemoryAuthorityReceiptAppendResult {
    validatePayload(payload, occurredAt);
    const normalized = normalizePayload(payload);
    const payloadDigest = digest(normalized);
    const existing = this.receiptsByRequest.get(payload.requestId);

    if (existing) {
      if (existing.payloadDigest !== payloadDigest || existing.memoryId !== payload.memoryId) {
        throw new MemoryAuthorityReceiptConflictError(
          'ALTERED_REPLAY',
          'The requestId was already bound to a different normalized transition payload.',
        );
      }
      return { kind: 'replayed', receipt: cloneReceipt(existing) };
    }

    const chain = this.receiptsByMemory.get(payload.memoryId) ?? [];
    const latest = chain.at(-1);
    const currentRevision = latest?.resultingRevision ?? 0;
    const currentState = latest?.to;

    if (payload.expectedRevision !== currentRevision) {
      throw new MemoryAuthorityReceiptConflictError(
        'REVISION_CONFLICT',
        `Expected revision ${payload.expectedRevision} does not match current revision ${currentRevision}.`,
      );
    }
    if (latest && payload.from !== currentState) {
      throw new MemoryAuthorityReceiptConflictError(
        'STATE_CONFLICT',
        `Receipt chain projects ${currentState}, not ${payload.from}.`,
      );
    }
    if (!latest && payload.expectedRevision !== 0) {
      throw new MemoryAuthorityReceiptConflictError('INVALID_REVISION', 'The first receipt must start at revision 0.');
    }

    const resultingRevision = payload.expectedRevision + 1;
    const receiptBase = {
      ...clonePayload(payload),
      resultingRevision,
      occurredAt,
      payloadDigest,
    };
    const integrityDigest = digest(receiptBase);
    const receipt: MemoryAuthorityTransitionReceipt = {
      ...receiptBase,
      receiptId: `memory-authority-receipt:${integrityDigest}`,
      integrityDigest,
    };

    chain.push(receipt);
    this.receiptsByMemory.set(payload.memoryId, chain);
    this.receiptsByRequest.set(payload.requestId, receipt);
    return { kind: 'appended', receipt: cloneReceipt(receipt) };
  }

  list(memoryId: string): readonly MemoryAuthorityTransitionReceipt[] {
    return (this.receiptsByMemory.get(memoryId) ?? []).map(cloneReceipt);
  }

  findByRequestId(requestId: string): MemoryAuthorityTransitionReceipt | undefined {
    const receipt = this.receiptsByRequest.get(requestId);
    return receipt ? cloneReceipt(receipt) : undefined;
  }
}

export function verifyMemoryAuthorityReceiptIntegrity(receipt: MemoryAuthorityTransitionReceipt): boolean {
  const { integrityDigest, receiptId: _receiptId, ...receiptBase } = receipt;
  return digest(receiptBase) === integrityDigest;
}

function validatePayload(payload: MemoryAuthorityReceiptPayload, occurredAt: string): void {
  if (!payload.memoryId.trim() || !payload.requestId.trim() || !payload.policyVersion.trim()) {
    throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', 'memoryId, requestId, and policyVersion are required.');
  }
  if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 0) {
    throw new MemoryAuthorityReceiptConflictError('INVALID_REVISION', 'expectedRevision must be a non-negative integer.');
  }
  if (!occurredAt.trim()) {
    throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', 'occurredAt is required.');
  }
}

function normalizePayload(payload: MemoryAuthorityReceiptPayload): unknown {
  return {
    ...clonePayload(payload),
    approvalDecisions: [...(payload.approvalDecisions ?? [])]
      .map((decision) => ({ ...decision, approver: { ...decision.approver } }))
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId)),
    evidenceIds: normalizeIds(payload.evidenceIds),
    contradictionDecisionIds: normalizeIds(payload.contradictionDecisionIds),
    admissionRecordIds: normalizeIds(payload.admissionRecordIds),
  };
}

function clonePayload(payload: MemoryAuthorityReceiptPayload): MemoryAuthorityReceiptPayload {
  return {
    ...payload,
    executor: { ...payload.executor },
    approvalDecisions: payload.approvalDecisions?.map((decision) => ({
      ...decision,
      approver: { ...decision.approver },
    })),
    evidenceIds: payload.evidenceIds ? [...payload.evidenceIds] : undefined,
    contradictionDecisionIds: payload.contradictionDecisionIds ? [...payload.contradictionDecisionIds] : undefined,
    admissionRecordIds: payload.admissionRecordIds ? [...payload.admissionRecordIds] : undefined,
  };
}

function cloneReceipt(receipt: MemoryAuthorityTransitionReceipt): MemoryAuthorityTransitionReceipt {
  return { ...receipt, ...clonePayload(receipt) };
}

function normalizeIds(values: readonly string[] | undefined): readonly string[] {
  return [...new Set(values ?? [])].sort();
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
