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
  readonly quarantineSignalIds?: readonly string[];
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
    const normalized = normalizePayload(payload);
    const normalizedOccurredAt = required(occurredAt, 'occurredAt');
    const payloadDigest = digest(normalized);
    const existing = this.receiptsByRequest.get(normalized.requestId);

    if (existing) {
      if (existing.payloadDigest !== payloadDigest || existing.memoryId !== normalized.memoryId) {
        throw new MemoryAuthorityReceiptConflictError(
          'ALTERED_REPLAY',
          'The requestId was already bound to a different normalized transition payload.',
        );
      }
      return { kind: 'replayed', receipt: cloneReceipt(existing) };
    }

    const chain = this.receiptsByMemory.get(normalized.memoryId) ?? [];
    const latest = chain.at(-1);
    const currentRevision = latest?.resultingRevision ?? 0;
    const currentState = latest?.to;

    if (normalized.expectedRevision !== currentRevision) {
      throw new MemoryAuthorityReceiptConflictError(
        'REVISION_CONFLICT',
        `Expected revision ${normalized.expectedRevision} does not match current revision ${currentRevision}.`,
      );
    }
    if (latest && normalized.from !== currentState) {
      throw new MemoryAuthorityReceiptConflictError(
        'STATE_CONFLICT',
        `Receipt chain projects ${currentState}, not ${normalized.from}.`,
      );
    }

    const resultingRevision = normalized.expectedRevision + 1;
    const receiptBase = {
      ...normalized,
      resultingRevision,
      occurredAt: normalizedOccurredAt,
      payloadDigest,
    };
    const integrityDigest = digest(receiptBase);
    const receipt: MemoryAuthorityTransitionReceipt = {
      ...receiptBase,
      receiptId: `memory-authority-receipt:${integrityDigest}`,
      integrityDigest,
    };

    const stored = cloneReceipt(receipt);
    this.receiptsByMemory.set(normalized.memoryId, [...chain, stored]);
    this.receiptsByRequest.set(normalized.requestId, stored);
    return { kind: 'appended', receipt: cloneReceipt(stored) };
  }

  list(memoryId: string): readonly MemoryAuthorityTransitionReceipt[] {
    return (this.receiptsByMemory.get(memoryId.trim()) ?? []).map(cloneReceipt);
  }

  findByRequestId(requestId: string): MemoryAuthorityTransitionReceipt | undefined {
    const receipt = this.receiptsByRequest.get(requestId.trim());
    return receipt ? cloneReceipt(receipt) : undefined;
  }
}

export function verifyMemoryAuthorityReceiptIntegrity(receipt: MemoryAuthorityTransitionReceipt): boolean {
  const { integrityDigest, receiptId: _receiptId, ...receiptBase } = receipt;
  return digest(receiptBase) === integrityDigest;
}

function normalizePayload(payload: MemoryAuthorityReceiptPayload): MemoryAuthorityReceiptPayload {
  if (!Number.isSafeInteger(payload.expectedRevision) || payload.expectedRevision < 0) {
    throw new MemoryAuthorityReceiptConflictError(
      'INVALID_REVISION',
      'expectedRevision must be a non-negative safe integer.',
    );
  }

  return {
    memoryId: required(payload.memoryId, 'memoryId'),
    from: payload.from,
    to: payload.to,
    requestId: required(payload.requestId, 'requestId'),
    expectedRevision: payload.expectedRevision,
    executor: normalizeActor(payload.executor),
    policyVersion: required(payload.policyVersion, 'policyVersion'),
    approvalDecisions: normalizeApprovals(payload.approvalDecisions),
    evidenceIds: normalizeIds(payload.evidenceIds),
    contradictionDecisionIds: normalizeIds(payload.contradictionDecisionIds),
    admissionRecordIds: normalizeIds(payload.admissionRecordIds),
    quarantineSignalIds: normalizeIds(payload.quarantineSignalIds),
    replacementMemoryId: payload.replacementMemoryId?.trim() || undefined,
    reasonCode: required(payload.reasonCode, 'reasonCode'),
    reason: required(payload.reason, 'reason'),
  };
}

function normalizeApprovals(
  approvals: readonly MemoryApprovalDecision[] | undefined,
): readonly MemoryApprovalDecision[] | undefined {
  if (!approvals) return undefined;
  return approvals
    .map((decision) => ({
      decisionId: required(decision.decisionId, 'approval decisionId'),
      approver: normalizeActor(decision.approver),
      outcome: decision.outcome,
      policyVersion: required(decision.policyVersion, 'approval policyVersion'),
    }))
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
}

function normalizeActor(actor: MemoryAuthorityActor): MemoryAuthorityActor {
  return { id: required(actor.id, 'actor id'), type: actor.type };
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
    quarantineSignalIds: payload.quarantineSignalIds ? [...payload.quarantineSignalIds] : undefined,
  };
}

function cloneReceipt(receipt: MemoryAuthorityTransitionReceipt): MemoryAuthorityTransitionReceipt {
  return { ...receipt, ...clonePayload(receipt) };
}

function normalizeIds(values: readonly string[] | undefined): readonly string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values.map((value) => required(value, 'reference id')))].sort();
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemoryAuthorityReceiptConflictError('INVALID_INPUT', `${field} is required.`);
  }
  return normalized;
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
