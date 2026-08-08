import { stableHash } from '../utils/hash';
import type { ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import type { ApprovalReceipt } from './approval-contract';
import {
  ApprovalCapabilityMismatchError,
  ApprovalRevisionMismatchError,
  InvalidApprovalInputError,
} from './approval-errors';

export interface ApprovalReceiptStore {
  transaction<T>(callback: (receipts: readonly ApprovalReceipt[]) => Promise<T>): Promise<T>;
  write(receipts: readonly ApprovalReceipt[]): Promise<void>;
}

export interface ApprovalDecisionInput {
  readonly planId: string;
  readonly revisionId: string;
  readonly decision: 'approved' | 'rejected';
  readonly approvedCapabilities: readonly string[];
  readonly decidedBy: string;
}

export interface ApprovalManagerOptions {
  readonly now?: () => Date;
}

export class ApprovalManager {
  private readonly now: () => Date;

  constructor(private readonly store: ApprovalReceiptStore, options: ApprovalManagerOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async decide(plan: ProposedPlan, input: ApprovalDecisionInput): Promise<ApprovalReceipt> {
    const planId = clean(input.planId, 'planId');
    const revisionId = clean(input.revisionId, 'revisionId');
    const decidedBy = clean(input.decidedBy, 'decidedBy');
    if (planId !== plan.id || revisionId !== plan.revisionId) throw new ApprovalRevisionMismatchError(plan.id);

    const requested = [...new Set(plan.requestedCapabilities.map((item) => item.capabilityId))].sort();
    const approved = [...new Set(input.approvedCapabilities.map((item) => clean(item, 'approvedCapabilities')))].sort();
    if (input.decision === 'approved' && !sameStrings(requested, approved)) {
      throw new ApprovalCapabilityMismatchError(plan.id);
    }
    if (input.decision === 'rejected' && approved.length > 0) {
      throw new InvalidApprovalInputError('approvedCapabilities', 'Rejected decisions cannot approve capabilities');
    }

    const decidedAt = this.now().toISOString();
    const canonical = { planId, revisionId, decision: input.decision, approvedCapabilities: approved, decidedBy };
    const id = `approval:${stableHash(canonical)}`;
    const receipt: ApprovalReceipt = { id, ...canonical, decidedAt };

    return this.store.transaction(async (receipts) => {
      const existing = receipts.find((candidate) => candidate.id === id);
      if (existing) return cloneReceipt(existing);
      const conflicting = receipts.find((candidate) => candidate.planId === planId && candidate.revisionId === revisionId && candidate.decision !== input.decision);
      if (conflicting) {
        throw new InvalidApprovalInputError('decision', 'A conflicting decision already exists for this plan revision');
      }
      await this.store.write([...receipts.map(cloneReceipt), cloneReceipt(receipt)]);
      return cloneReceipt(receipt);
    });
  }

  async listForPlan(planId: string): Promise<readonly ApprovalReceipt[]> {
    const normalized = clean(planId, 'planId');
    return this.store.transaction(async (receipts) => receipts
      .filter((receipt) => receipt.planId === normalized)
      .map(cloneReceipt));
  }
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function clean(value: string, field: string): string {
  if (typeof value !== 'string') throw new InvalidApprovalInputError(field, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new InvalidApprovalInputError(field, `${field} is invalid`);
  }
  return normalized;
}

function cloneReceipt(receipt: ApprovalReceipt): ApprovalReceipt {
  return { ...receipt, approvedCapabilities: [...receipt.approvedCapabilities] };
}
