import { describe, expect, test } from 'vitest';
import { CapabilityRegistry } from '../capability/capability-registry';
import { GOAL_CONTRACT_VERSION, type UniversalGoal } from '../goal/goal-contract';
import { PROPOSED_PLAN_CONTRACT_VERSION, type ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { ApprovalManager, type ApprovalReceiptStore } from './approval-manager';
import { ApprovalCapabilityMismatchError, ApprovalRevisionMismatchError, InvalidApprovalInputError } from './approval-errors';
import { PlanRiskAssessor } from './plan-risk-assessor';

const now = '2026-08-08T14:00:00.000Z';
function goal(policy: UniversalGoal['approvalConfig']['policy'] = 'none'): UniversalGoal {
  return {
    contractVersion: GOAL_CONTRACT_VERSION, id: 'goal:1', title: 'Goal', desiredOutcome: 'Outcome', successCriteria: ['Done'],
    constraints: { allowedCapabilities: ['web.search', 'email.send'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.search', 'email.send'], forbiddenCapabilities: [], allowedDataScopes: ['public_web'], forbiddenActions: [],
    autonomyLevel: 'assisted', approvalConfig: { policy }, notificationConfig: { policy: 'none' }, memoryConfig: { policy: 'none' },
    terminationConditions: [], status: 'active', createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}
function plan(capabilityId = 'web.search'): ProposedPlan {
  return {
    contractVersion: PROPOSED_PLAN_CONTRACT_VERSION, id: 'plan:1', goalId: 'goal:1', planSummary: 'Plan', planTasks: [],
    requestedCapabilities: [{ capabilityId, version: '1' }], expectedEvidence: [], approvalCheckpoints: [], completionConditions: [],
    status: 'draft', revisionNumber: 1, previousRevisionId: null, revisionId: 'plan:1:rev:1', contentHash: 'hash',
    createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}
function registry() {
  return new CapabilityRegistry([
    { id: 'web.search', version: '1', provider: 'browser', riskLevel: 'r0_observe', consentPolicy: 'none', allowedDataScopes: ['public_web'], credentialScopes: [], health: 'available' },
    { id: 'email.send', version: '1', provider: 'email', riskLevel: 'r2_external', consentPolicy: 'always', allowedDataScopes: ['public_web'], credentialScopes: ['email.send'], health: 'available' },
  ]);
}
function store(): ApprovalReceiptStore {
  let receipts = [] as Awaited<ReturnType<ApprovalManager['listForPlan']>> extends readonly (infer T)[] ? T[] : never;
  return { transaction: async (callback) => callback(receipts), write: async (next) => { receipts = [...next]; } };
}

describe('approval and risk engine', () => {
  test('R0 observation can remain approval-free when Goal policy is none', () => {
    expect(new PlanRiskAssessor(registry()).assess(plan(), goal())).toMatchObject({ highestRisk: 'r0_observe', approvalRequirement: 'none' });
  });
  test('external action with always-consent requires explicit approval', () => {
    expect(new PlanRiskAssessor(registry()).assess(plan('email.send'), goal())).toMatchObject({ highestRisk: 'r2_external', approvalRequirement: 'explicit' });
  });
  test('Goal all_actions policy escalates even observation to explicit approval', () => {
    expect(new PlanRiskAssessor(registry()).assess(plan(), goal('all_actions')).approvalRequirement).toBe('explicit');
  });
  test('approval receipt binds exact plan revision and exact capability set and replays idempotently', async () => {
    const manager = new ApprovalManager(store(), { now: () => new Date(now) });
    const current = plan();
    const input = { planId: current.id, revisionId: current.revisionId, decision: 'approved' as const, approvedCapabilities: ['web.search'], decidedBy: 'user:local' };
    const first = await manager.decide(current, input);
    const replay = await manager.decide(current, input);
    expect(replay).toEqual(first);
    await expect(manager.decide(current, { ...input, revisionId: 'stale' })).rejects.toThrow(ApprovalRevisionMismatchError);
    await expect(manager.decide(current, { ...input, approvedCapabilities: [] })).rejects.toThrow(ApprovalCapabilityMismatchError);
  });
  test('rejected decisions cannot smuggle approved capabilities', async () => {
    const manager = new ApprovalManager(store());
    const current = plan();
    await expect(manager.decide(current, { planId: current.id, revisionId: current.revisionId, decision: 'rejected', approvedCapabilities: ['web.search'], decidedBy: 'user:local' })).rejects.toThrow(InvalidApprovalInputError);
  });
});
