import type { ApprovalReceipt } from '../approval/approval-contract';
import { PlanRiskAssessor } from '../approval/plan-risk-assessor';
import type { CapabilityAuthorizationContext } from '../capability/capability-contract';
import { CapabilityRegistry } from '../capability/capability-registry';
import type { UniversalGoal } from '../goal/goal-contract';
import type { ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { stableHash } from '../utils/hash';
import type { CapabilityExecutionAdapter, ExecuteCapabilityInput, ExecutionRecord } from './execution-contract';
import {
  ExecutionAdapterNotFoundError,
  ExecutionApprovalRequiredError,
  ExecutionCapabilityDeniedError,
  ExecutionIdempotencyConflictError,
  ExecutionInDoubtError,
  InvalidExecutionInputError,
} from './execution-errors';

export interface ExecutionRecordStore {
  transaction<T>(callback: (records: readonly ExecutionRecord[]) => Promise<T>): Promise<T>;
  write(records: readonly ExecutionRecord[]): Promise<void>;
}

export interface ExecutionEngineOptions {
  readonly now?: () => Date;
}

export class ExecutionEngine {
  private readonly adapters = new Map<string, CapabilityExecutionAdapter>();
  private readonly now: () => Date;
  private readonly riskAssessor: PlanRiskAssessor;

  constructor(
    private readonly store: ExecutionRecordStore,
    private readonly capabilities: CapabilityRegistry,
    adapters: readonly CapabilityExecutionAdapter[] = [],
    options: ExecutionEngineOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.riskAssessor = new PlanRiskAssessor(capabilities);
    for (const adapter of adapters) this.registerAdapter(adapter);
  }

  registerAdapter(adapter: CapabilityExecutionAdapter): void {
    const capabilityId = clean(adapter.capabilityId, 'capabilityId');
    if (this.adapters.has(capabilityId)) throw new InvalidExecutionInputError('capabilityId', `Execution adapter already registered: ${capabilityId}`);
    this.adapters.set(capabilityId, adapter);
  }

  async execute(input: ExecuteCapabilityInput, plan: ProposedPlan, goal: UniversalGoal, approval?: ApprovalReceipt): Promise<ExecutionRecord> {
    const normalized = normalizeInput(input);
    this.validateAuthority(normalized, plan, goal, approval);
    const adapter = this.adapters.get(normalized.capabilityId);
    if (!adapter) throw new ExecutionAdapterNotFoundError(normalized.capabilityId);

    const requestHash = stableHash({
      planId: normalized.planId,
      revisionId: normalized.revisionId,
      capabilityId: normalized.capabilityId,
      capabilityVersion: normalized.capabilityVersion,
      idempotencyKey: normalized.idempotencyKey,
      payload: normalized.payload,
      actor: normalized.actor,
    });
    const executionId = `execution:${stableHash({ idempotencyKey: normalized.idempotencyKey, planId: normalized.planId })}`;

    const reservation = await this.store.transaction(async (records) => {
      const previous = latestByIdempotencyKey(records, normalized.idempotencyKey);
      if (previous) {
        if (previous.requestHash !== requestHash) throw new ExecutionIdempotencyConflictError(normalized.idempotencyKey);
        if (previous.status === 'completed') return { replay: true as const, record: cloneRecord(previous) };
        throw new ExecutionInDoubtError(previous.executionId);
      }
      const record: ExecutionRecord = {
        executionId,
        sequence: 1,
        planId: normalized.planId,
        revisionId: normalized.revisionId,
        capabilityId: normalized.capabilityId,
        ...(normalized.capabilityVersion === undefined ? {} : { capabilityVersion: normalized.capabilityVersion }),
        idempotencyKey: normalized.idempotencyKey,
        requestHash,
        status: 'reserved',
        reservedAt: this.now().toISOString(),
        actor: normalized.actor,
      };
      await this.store.write([...records.map(cloneRecord), cloneRecord(record)]);
      return { replay: false as const, record };
    });
    if (reservation.replay) return reservation.record;

    try {
      const result = await adapter.execute({
        executionId,
        idempotencyKey: normalized.idempotencyKey,
        payload: normalized.payload,
      });
      return this.appendTerminal(reservation.record, 'completed', { result: clonePayload(result) });
    } catch {
      await this.appendTerminal(reservation.record, 'in_doubt');
      throw new ExecutionInDoubtError(executionId);
    }
  }

  async reconcile(executionId: string, outcome: { readonly status: 'completed' | 'failed'; readonly result?: Readonly<Record<string, unknown>>; readonly failureCode?: string }): Promise<ExecutionRecord> {
    const id = clean(executionId, 'executionId');
    return this.store.transaction(async (records) => {
      const current = latestByExecutionId(records, id);
      if (!current) throw new InvalidExecutionInputError('executionId', 'Execution does not exist');
      if (current.status === 'completed' || current.status === 'failed') return cloneRecord(current);
      if (current.status !== 'in_doubt') throw new InvalidExecutionInputError('status', 'Only in-doubt executions can be reconciled');
      const next: ExecutionRecord = {
        ...current,
        sequence: current.sequence + 1,
        status: outcome.status,
        ...(outcome.status === 'completed' ? { completedAt: this.now().toISOString(), result: clonePayload(outcome.result ?? {}) } : { failedAt: this.now().toISOString(), failureCode: clean(outcome.failureCode ?? 'reconciled_failure', 'failureCode') }),
      };
      await this.store.write([...records.map(cloneRecord), cloneRecord(next)]);
      return cloneRecord(next);
    });
  }

  private validateAuthority(input: ExecuteCapabilityInput, plan: ProposedPlan, goal: UniversalGoal, approval?: ApprovalReceipt): void {
    if (input.planId !== plan.id || input.revisionId !== plan.revisionId || plan.goalId !== goal.id) {
      throw new ExecutionCapabilityDeniedError(input.capabilityId, 'plan_or_revision_mismatch');
    }
    const requested = plan.requestedCapabilities.find((item) => item.capabilityId === input.capabilityId);
    if (!requested) throw new ExecutionCapabilityDeniedError(input.capabilityId, 'capability_not_in_plan');
    if (requested.version !== undefined && input.capabilityVersion !== requested.version) {
      throw new ExecutionCapabilityDeniedError(input.capabilityId, 'capability_version_mismatch');
    }

    this.capabilities.authorize({ capabilityId: input.capabilityId, ...(input.capabilityVersion === undefined ? {} : { version: input.capabilityVersion }) }, authorizationContext(plan.id, goal));
    const capabilityAssessment = this.riskAssessor.assess(plan, goal).capabilities.find((item) => item.capabilityId === input.capabilityId);
    if (!capabilityAssessment) throw new ExecutionCapabilityDeniedError(input.capabilityId, 'risk_assessment_missing');
    if (capabilityAssessment.approvalRequirement !== 'none') {
      if (!approval || approval.decision !== 'approved' || approval.planId !== plan.id || approval.revisionId !== plan.revisionId || !approval.approvedCapabilities.includes(input.capabilityId)) {
        throw new ExecutionApprovalRequiredError(plan.id, input.capabilityId);
      }
    }
  }

  private async appendTerminal(base: ExecutionRecord, status: 'completed' | 'in_doubt', extra: { readonly result?: Readonly<Record<string, unknown>> } = {}): Promise<ExecutionRecord> {
    return this.store.transaction(async (records) => {
      const current = latestByExecutionId(records, base.executionId);
      if (!current) throw new InvalidExecutionInputError('executionId', 'Reserved execution disappeared');
      const next: ExecutionRecord = {
        ...current,
        sequence: current.sequence + 1,
        status,
        ...(status === 'completed' ? { completedAt: this.now().toISOString(), result: clonePayload(extra.result ?? {}) } : {}),
      };
      await this.store.write([...records.map(cloneRecord), cloneRecord(next)]);
      return cloneRecord(next);
    });
  }
}

function normalizeInput(input: ExecuteCapabilityInput): ExecuteCapabilityInput {
  return {
    planId: clean(input.planId, 'planId'), revisionId: clean(input.revisionId, 'revisionId'), capabilityId: clean(input.capabilityId, 'capabilityId'),
    ...(input.capabilityVersion === undefined ? {} : { capabilityVersion: clean(input.capabilityVersion, 'capabilityVersion') }),
    idempotencyKey: clean(input.idempotencyKey, 'idempotencyKey'), payload: clonePayload(input.payload), actor: clean(input.actor, 'actor'),
  };
}
function clean(value: string, field: string): string {
  if (typeof value !== 'string') throw new InvalidExecutionInputError(field, `${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new InvalidExecutionInputError(field, `${field} is invalid`);
  return normalized;
}
function clonePayload(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> { return structuredClone(value); }
function cloneRecord(record: ExecutionRecord): ExecutionRecord { return { ...record, ...(record.result ? { result: clonePayload(record.result) } : {}) }; }
function latestByIdempotencyKey(records: readonly ExecutionRecord[], key: string): ExecutionRecord | undefined { return records.filter((record) => record.idempotencyKey === key).sort((a, b) => b.sequence - a.sequence)[0]; }
function latestByExecutionId(records: readonly ExecutionRecord[], id: string): ExecutionRecord | undefined { return records.filter((record) => record.executionId === id).sort((a, b) => b.sequence - a.sequence)[0]; }
function authorizationContext(planId: string, goal: UniversalGoal): CapabilityAuthorizationContext {
  const constrainedCapabilities = goal.constraints?.allowedCapabilities ?? [];
  const constrainedScopes = goal.constraints?.allowedDataScopes ?? [];
  return {
    planId,
    goalAllowedCapabilities: constrainedCapabilities.length === 0 ? [...goal.allowedCapabilities] : goal.allowedCapabilities.filter((item) => constrainedCapabilities.includes(item)),
    goalForbiddenCapabilities: [...new Set([...(goal.forbiddenCapabilities ?? []), ...(goal.constraints?.forbiddenCapabilities ?? [])])],
    goalAllowedDataScopes: constrainedScopes.length === 0 ? [...goal.allowedDataScopes] : goal.allowedDataScopes.filter((item) => constrainedScopes.includes(item)),
    goalForbiddenDataScopes: [...new Set(goal.constraints?.forbiddenDataScopes ?? [])],
  };
}
