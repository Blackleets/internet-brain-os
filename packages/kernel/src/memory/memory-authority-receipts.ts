import { createHash } from 'node:crypto';
import type {
  MemoryApprovalDecision,
  MemoryAuthorityActor,
  MemoryAuthorityState,
} from './memory-authority-lifecycle';

export interface MemoryTransitionReceiptInput {
  readonly memoryId: string;
  readonly from: MemoryAuthorityState;
  readonly to: MemoryAuthorityState;
  readonly requestId: string;
  readonly expectedRevision: number;
  readonly executor: MemoryAuthorityActor;
  readonly approvalDecisions?: readonly MemoryApprovalDecision[];
  readonly policyVersion: string;
  readonly evidenceIds?: readonly string[];
  readonly contradictionDecisionIds?: readonly string[];
  readonly admissionRecordIds?: readonly string[];
  readonly quarantineSignalIds?: readonly string[];
  readonly replacementMemoryId?: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface MemoryTransitionReceipt extends MemoryTransitionReceiptInput {
  readonly receiptId: string;
  readonly resultingRevision: number;
  readonly requestDigest: string;
  readonly integrityDigest: string;
}

export type MemoryReceiptAppendFailureCode =
  | 'INVALID_INPUT'
  | 'REVISION_CONFLICT'
  | 'STATE_CONFLICT'
  | 'ALTERED_REPLAY';

export class MemoryReceiptAppendError extends Error {
  constructor(
    readonly code: MemoryReceiptAppendFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'MemoryReceiptAppendError';
  }
}

export interface MemoryTransitionReceiptRepository {
  append(input: MemoryTransitionReceiptInput): MemoryTransitionReceipt;
  list(memoryId: string): readonly MemoryTransitionReceipt[];
  findByRequestId(requestId: string): MemoryTransitionReceipt | undefined;
}

export class InMemoryMemoryTransitionReceiptRepository implements MemoryTransitionReceiptRepository {
  private readonly receiptsByMemory = new Map<string, MemoryTransitionReceipt[]>();
  private readonly receiptsByRequest = new Map<string, MemoryTransitionReceipt>();

  append(input: MemoryTransitionReceiptInput): MemoryTransitionReceipt {
    const normalized = normalizeInput(input);
    const requestDigest = digest(normalized);
    const priorRequest = this.receiptsByRequest.get(normalized.requestId);

    if (priorRequest) {
      if (priorRequest.memoryId !== normalized.memoryId || priorRequest.requestDigest !== requestDigest) {
        throw new MemoryReceiptAppendError(
          'ALTERED_REPLAY',
          'The requestId is already bound to a different normalized transition payload.',
        );
      }
      return cloneReceipt(priorRequest);
    }

    const chain = this.receiptsByMemory.get(normalized.memoryId) ?? [];
    const latest = chain.at(-1);
    const currentRevision = latest?.resultingRevision ?? 0;
    const currentState = latest?.to;

    if (normalized.expectedRevision !== currentRevision) {
      throw new MemoryReceiptAppendError(
        'REVISION_CONFLICT',
        `Expected revision ${normalized.expectedRevision} does not match current revision ${currentRevision}.`,
      );
    }

    if (latest && normalized.from !== currentState) {
      throw new MemoryReceiptAppendError(
        'STATE_CONFLICT',
        `Transition starts from ${normalized.from}, but the projected state is ${currentState}.`,
      );
    }

    const resultingRevision = normalized.expectedRevision + 1;
    const receiptWithoutDigests = {
      ...normalized,
      receiptId: `memory-receipt:${digest({ memoryId: normalized.memoryId, requestId: normalized.requestId, resultingRevision })}`,
      resultingRevision,
      requestDigest,
    };
    const receipt: MemoryTransitionReceipt = {
      ...receiptWithoutDigests,
      integrityDigest: digest(receiptWithoutDigests),
    };

    const stored = cloneReceipt(receipt);
    this.receiptsByMemory.set(normalized.memoryId, [...chain, stored]);
    this.receiptsByRequest.set(normalized.requestId, stored);
    return cloneReceipt(stored);
  }

  list(memoryId: string): readonly MemoryTransitionReceipt[] {
    return (this.receiptsByMemory.get(memoryId.trim()) ?? []).map(cloneReceipt);
  }

  findByRequestId(requestId: string): MemoryTransitionReceipt | undefined {
    const receipt = this.receiptsByRequest.get(requestId.trim());
    return receipt ? cloneReceipt(receipt) : undefined;
  }
}

export function verifyMemoryTransitionReceipt(receipt: MemoryTransitionReceipt): boolean {
  const { integrityDigest, ...withoutIntegrity } = receipt;
  return integrityDigest === digest(withoutIntegrity);
}

function normalizeInput(input: MemoryTransitionReceiptInput): MemoryTransitionReceiptInput {
  const memoryId = required(input.memoryId, 'memoryId');
  const requestId = required(input.requestId, 'requestId');
  const policyVersion = required(input.policyVersion, 'policyVersion');
  const reasonCode = required(input.reasonCode, 'reasonCode');
  const reason = required(input.reason, 'reason');
  const occurredAt = required(input.occurredAt, 'occurredAt');

  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    throw new MemoryReceiptAppendError('INVALID_INPUT', 'expectedRevision must be a non-negative safe integer.');
  }

  return {
    memoryId,
    from: input.from,
    to: input.to,
    requestId,
    expectedRevision: input.expectedRevision,
    executor: cloneActor(input.executor),
    approvalDecisions: sortApprovals(input.approvalDecisions ?? []),
    policyVersion,
    evidenceIds: sortedUnique(input.evidenceIds ?? []),
    contradictionDecisionIds: sortedUnique(input.contradictionDecisionIds ?? []),
    admissionRecordIds: sortedUnique(input.admissionRecordIds ?? []),
    quarantineSignalIds: sortedUnique(input.quarantineSignalIds ?? []),
    replacementMemoryId: input.replacementMemoryId?.trim() || undefined,
    reasonCode,
    reason,
    occurredAt,
  };
}

function sortApprovals(approvals: readonly MemoryApprovalDecision[]): readonly MemoryApprovalDecision[] {
  return approvals
    .map((approval) => ({
      decisionId: required(approval.decisionId, 'approval decisionId'),
      approver: cloneActor(approval.approver),
      outcome: approval.outcome,
      policyVersion: required(approval.policyVersion, 'approval policyVersion'),
    }))
    .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
}

function cloneActor(actor: MemoryAuthorityActor): MemoryAuthorityActor {
  return { id: required(actor.id, 'actor id'), type: actor.type };
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => required(value, 'reference id')))].sort();
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MemoryReceiptAppendError('INVALID_INPUT', `${field} must be non-empty.`);
  }
  return normalized;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .filter((key) => object[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function cloneReceipt(receipt: MemoryTransitionReceipt): MemoryTransitionReceipt {
  return {
    ...receipt,
    executor: { ...receipt.executor },
    approvalDecisions: receipt.approvalDecisions?.map((decision) => ({
      ...decision,
      approver: { ...decision.approver },
    })),
    evidenceIds: [...(receipt.evidenceIds ?? [])],
    contradictionDecisionIds: [...(receipt.contradictionDecisionIds ?? [])],
    admissionRecordIds: [...(receipt.admissionRecordIds ?? [])],
    quarantineSignalIds: [...(receipt.quarantineSignalIds ?? [])],
  };
}
