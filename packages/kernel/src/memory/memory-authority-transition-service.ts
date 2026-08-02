import {
  validateMemoryAuthorityTransition,
  type MemoryAuthorityTransitionFailureCode,
  type MemoryAuthorityTransitionRequest,
} from './memory-authority-lifecycle';
import {
  MemoryAuthorityReceiptConflictError,
  type MemoryAuthorityReceiptAppendResult,
  type MemoryAuthorityReceiptPayload,
  type MemoryAuthorityReceiptRepository,
  type MemoryAuthorityTransitionReceipt,
} from './memory-authority-receipt-repository';

export interface ExecuteMemoryAuthorityTransitionInput {
  readonly transition: MemoryAuthorityTransitionRequest;
  readonly receipt: MemoryAuthorityReceiptPayload;
  readonly occurredAt: string;
}

export type ExecuteMemoryAuthorityTransitionResult =
  | {
      readonly ok: true;
      readonly kind: MemoryAuthorityReceiptAppendResult['kind'];
      readonly receipt: MemoryAuthorityTransitionReceipt;
      readonly state: MemoryAuthorityTransitionReceipt['to'];
      readonly revision: number;
    }
  | {
      readonly ok: false;
      readonly code: MemoryAuthorityTransitionFailureCode | MemoryAuthorityReceiptConflictError['code'] | 'CONTRACT_MISMATCH';
      readonly message: string;
    };

/**
 * Fail-closed boundary that composes lifecycle authorization with append-only receipts.
 * Existing requestIds are delegated directly to the repository so exact replays remain
 * idempotent and altered replays are rejected before current-state validation can mask them.
 */
export class MemoryAuthorityTransitionService {
  constructor(private readonly repository: MemoryAuthorityReceiptRepository) {}

  execute(input: ExecuteMemoryAuthorityTransitionInput): ExecuteMemoryAuthorityTransitionResult {
    const existing = this.repository.findByRequestId(input.receipt.requestId.trim());
    if (existing) {
      return this.append(input.receipt, input.occurredAt);
    }

    const mismatch = validateContractBinding(input.transition, input.receipt);
    if (mismatch) return mismatch;

    const validation = validateMemoryAuthorityTransition(input.transition);
    if (!validation.ok) {
      return {
        ok: false,
        code: validation.failureCode ?? 'INVALID_TRANSITION',
        message: validation.message ?? 'The authority transition was rejected.',
      };
    }

    return this.append(input.receipt, input.occurredAt);
  }

  private append(
    payload: MemoryAuthorityReceiptPayload,
    occurredAt: string,
  ): ExecuteMemoryAuthorityTransitionResult {
    try {
      const result = this.repository.append(payload, occurredAt);
      return {
        ok: true,
        kind: result.kind,
        receipt: result.receipt,
        state: result.receipt.to,
        revision: result.receipt.resultingRevision,
      };
    } catch (error) {
      if (error instanceof MemoryAuthorityReceiptConflictError) {
        return { ok: false, code: error.code, message: error.message };
      }
      throw error;
    }
  }
}

function validateContractBinding(
  transition: MemoryAuthorityTransitionRequest,
  receipt: MemoryAuthorityReceiptPayload,
): ExecuteMemoryAuthorityTransitionResult | undefined {
  if (
    transition.from !== receipt.from
    || transition.to !== receipt.to
    || transition.policyVersion.trim() !== receipt.policyVersion.trim()
    || transition.executor.id.trim() !== receipt.executor.id.trim()
    || transition.executor.type !== receipt.executor.type
  ) {
    return {
      ok: false,
      code: 'CONTRACT_MISMATCH',
      message: 'Lifecycle validation input and receipt payload must describe the same transition.',
    };
  }

  const transitionApprovals = normalizeApprovalIds(transition.approvalDecisions);
  const receiptApprovals = normalizeApprovalIds(receipt.approvalDecisions);
  if (transitionApprovals.join('\u0000') !== receiptApprovals.join('\u0000')) {
    return {
      ok: false,
      code: 'CONTRACT_MISMATCH',
      message: 'Receipt approval references must match the approvals used for authorization.',
    };
  }

  if ((transition.replacementMemoryId?.trim() || undefined) !== (receipt.replacementMemoryId?.trim() || undefined)) {
    return {
      ok: false,
      code: 'CONTRACT_MISMATCH',
      message: 'Receipt replacement identity must match the lifecycle validation input.',
    };
  }

  return undefined;
}

function normalizeApprovalIds(
  approvals: MemoryAuthorityTransitionRequest['approvalDecisions'],
): string[] {
  return [...new Set((approvals ?? []).map((decision) => decision.decisionId.trim()))].sort();
}
