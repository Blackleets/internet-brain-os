import { describe, expect, test, vi } from 'vitest';
import type { ApprovalReceipt } from '../approval/approval-contract';
import { CapabilityRegistry } from '../capability/capability-registry';
import { GOAL_CONTRACT_VERSION, type UniversalGoal } from '../goal/goal-contract';
import { PROPOSED_PLAN_CONTRACT_VERSION, type ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { ExecutionEngine, type ExecutionRecordStore } from './execution-engine';
import type { CapabilityExecutionAdapter, ExecutionRecord } from './execution-contract';
import { ExecutionApprovalRequiredError, ExecutionIdempotencyConflictError, ExecutionInDoubtError } from './execution-errors';

const now = '2026-08-08T14:00:00.000Z';
function goal(): UniversalGoal {
  return {
    contractVersion: GOAL_CONTRACT_VERSION, id: 'goal:1', title: 'Goal', desiredOutcome: 'Outcome', successCriteria: ['Done'],
    constraints: { allowedCapabilities: ['web.search', 'email.send'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.search', 'email.send'], forbiddenCapabilities: [], allowedDataScopes: ['public_web'], forbiddenActions: [],
    autonomyLevel: 'assisted', approvalConfig: { policy: 'none' }, notificationConfig: { policy: 'none' }, memoryConfig: { policy: 'none' },
    terminationConditions: [], status: 'active', createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} }, currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}
function plan(capabilityId = 'web.search'): ProposedPlan {
  return {
    contractVersion: PROPOSED_PLAN_CONTRACT_VERSION, id: 'plan:1', goalId: 'goal:1', planSummary: 'Plan', planTasks: [],
    requestedCapabilities: [{ capabilityId, version: '1' }], expectedEvidence: [], approvalCheckpoints: [], completionConditions: [],
    status: 'draft', revisionNumber: 1, previousRevisionId: null, revisionId: 'plan:1:rev:1', contentHash: 'hash', createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} }, currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}
function registry() {
  return new CapabilityRegistry([
    { id: 'web.search', version: '1', provider: 'browser', riskLevel: 'r0_observe', consentPolicy: 'none', allowedDataScopes: ['public_web'], credentialScopes: [], health: 'available' },
    { id: 'email.send', version: '1', provider: 'email', riskLevel: 'r2_external', consentPolicy: 'always', allowedDataScopes: ['public_web'], credentialScopes: ['email.send'], health: 'available' },
  ]);
}
function store(): ExecutionRecordStore {
  let records: ExecutionRecord[] = [];
  return { transaction: async (callback) => callback(records), write: async (next) => { records = next.map((record) => ({ ...record })); } };
}
function adapter(capabilityId: string, execute = vi.fn(async () => ({ ok: true }))): CapabilityExecutionAdapter { return { capabilityId, execute }; }
function approval(capabilityId: string): ApprovalReceipt {
  return { id: 'approval:1', planId: 'plan:1', revisionId: 'plan:1:rev:1', decision: 'approved', approvedCapabilities: [capabilityId], decidedBy: 'user:local', decidedAt: now };
}

describe('ExecutionEngine', () => {
  test('executes an authorized R0 capability and exact replay does not call the adapter twice', async () => {
    const execute = vi.fn(async () => ({ candidates: 3 }));
    const engine = new ExecutionEngine(store(), registry(), [adapter('web.search', execute)], { now: () => new Date(now) });
    const input = { planId: 'plan:1', revisionId: 'plan:1:rev:1', capabilityId: 'web.search', capabilityVersion: '1', idempotencyKey: 'idem:1', payload: { q: 'drill' }, actor: 'system' };
    const first = await engine.execute(input, plan(), goal());
    const replay = await engine.execute(input, plan(), goal());
    expect(first.status).toBe('completed');
    expect(replay.status).toBe('completed');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('same idempotency key with altered payload is blocked', async () => {
    const engine = new ExecutionEngine(store(), registry(), [adapter('web.search')], { now: () => new Date(now) });
    const base = { planId: 'plan:1', revisionId: 'plan:1:rev:1', capabilityId: 'web.search', capabilityVersion: '1', idempotencyKey: 'idem:1', payload: { q: 'drill' }, actor: 'system' };
    await engine.execute(base, plan(), goal());
    await expect(engine.execute({ ...base, payload: { q: 'laptop' } }, plan(), goal())).rejects.toThrow(ExecutionIdempotencyConflictError);
  });

  test('R2 external capability cannot execute without an exact approval receipt', async () => {
    const engine = new ExecutionEngine(store(), registry(), [adapter('email.send')]);
    const input = { planId: 'plan:1', revisionId: 'plan:1:rev:1', capabilityId: 'email.send', capabilityVersion: '1', idempotencyKey: 'idem:mail', payload: { draftId: 'draft:1' }, actor: 'user:local' };
    await expect(engine.execute(input, plan('email.send'), goal())).rejects.toThrow(ExecutionApprovalRequiredError);
    await expect(engine.execute(input, plan('email.send'), goal(), approval('email.send'))).resolves.toMatchObject({ status: 'completed' });
  });

  test('adapter failure becomes in-doubt and retry cannot duplicate the external action', async () => {
    const execute = vi.fn(async () => { throw new Error('socket lost'); });
    const engine = new ExecutionEngine(store(), registry(), [adapter('web.search', execute)]);
    const input = { planId: 'plan:1', revisionId: 'plan:1:rev:1', capabilityId: 'web.search', capabilityVersion: '1', idempotencyKey: 'idem:doubt', payload: { q: 'drill' }, actor: 'system' };
    await expect(engine.execute(input, plan(), goal())).rejects.toThrow(ExecutionInDoubtError);
    await expect(engine.execute(input, plan(), goal())).rejects.toThrow(ExecutionInDoubtError);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('in-doubt execution can be explicitly reconciled without re-running the adapter', async () => {
    const execute = vi.fn(async () => { throw new Error('response lost'); });
    const engine = new ExecutionEngine(store(), registry(), [adapter('web.search', execute)], { now: () => new Date(now) });
    const input = { planId: 'plan:1', revisionId: 'plan:1:rev:1', capabilityId: 'web.search', capabilityVersion: '1', idempotencyKey: 'idem:reconcile', payload: { q: 'drill' }, actor: 'system' };
    let executionId = '';
    try { await engine.execute(input, plan(), goal()); } catch (error) { executionId = (error as ExecutionInDoubtError).executionId; }
    await expect(engine.reconcile(executionId, { status: 'completed', result: { recovered: true } })).resolves.toMatchObject({ status: 'completed', result: { recovered: true } });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
