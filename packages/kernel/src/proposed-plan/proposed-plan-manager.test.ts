import { describe, expect, it } from 'vitest';
import type { UniversalGoal } from '../goal/goal-contract';
import { GOAL_CONTRACT_VERSION } from '../goal/goal-contract';
import type { MissionTask, MissionTaskId } from '../mission/mission-types';
import type { ProposedPlan } from './proposed-plan-contract';
import { PROPOSED_PLAN_CONTRACT_VERSION } from './proposed-plan-contract';
import { ProposedPlanManager, type ProposedPlanStore } from './proposed-plan-manager';
import {
  GoalNotFoundForPlanError,
  InvalidProposedPlanInputError,
  ProposedPlanCapabilityDeniedError,
  ProposedPlanDependencyError,
} from './proposed-plan-errors';

class TestPlanStore implements ProposedPlanStore {
  private plans: ProposedPlan[] = [];

  async transaction<T>(callback: (plans: ProposedPlan[]) => Promise<T>): Promise<T> {
    return callback(structuredClone(this.plans));
  }

  async write(plans: ProposedPlan[]): Promise<void> {
    this.plans = structuredClone(plans);
  }
}

function createTestGoal(overrides: Partial<UniversalGoal> = {}): UniversalGoal {
  const now = '2026-08-08T00:00:00.000Z';
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:test-id',
    title: 'Test Goal',
    description: 'A test goal',
    desiredOutcome: 'Find something useful',
    successCriteria: ['Criteria met'],
    constraints: {
      maxBudget: 1000,
      maxDurationMs: 3_600_000,
      maxMissions: 1,
      maxConcurrentMissions: 1,
      allowedDomains: ['example.com'],
      forbiddenDomains: ['evil.com'],
      allowedCapabilities: ['public_web_research'],
      forbiddenCapabilities: ['purchase'],
      allowedDataScopes: ['public_web'],
      forbiddenDataScopes: ['private'],
      forbiddenActions: ['purchase', 'submit'],
    },
    frequency: 'once',
    allowedCapabilities: ['public_web_research'],
    forbiddenCapabilities: ['purchase'],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase', 'submit'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    ...overrides,
  };
}

function createTestTask(id = 'task:1', dependsOn: readonly string[] = []): MissionTask {
  return {
    id: id as MissionTaskId,
    title: `Task ${id}`,
    objective: 'Do something bounded',
    status: 'pending',
    dependsOn: dependsOn.map((dependency) => dependency as MissionTaskId),
    evidenceRequirements: [{ key: 'evidence1', description: 'Some evidence', required: true }],
  };
}

function createInput(goalId: string, planTasks: readonly MissionTask[] = [createTestTask()]) {
  return {
    goalId,
    planSummary: 'A test plan',
    planTasks,
    requestedCapabilities: [{ capabilityId: 'public_web_research' }],
    expectedEvidence: [{ key: 'evidence1', description: 'Some evidence' }],
    approvalCheckpoints: [],
    completionConditions: planTasks.length === 0
      ? []
      : [{ description: 'Task completed', dependsOn: [planTasks[0]!.id] }],
  };
}

describe('ProposedPlanManager', () => {
  it('creates a draft proposal bound to the Goal contract', async () => {
    const store = new TestPlanStore();
    const goal = createTestGoal({ id: 'goal:123' });
    const manager = new ProposedPlanManager(store, async (goalId) => goalId === goal.id ? goal : null, {
      createId: () => 'proposed-plan:123',
      now: () => new Date('2026-08-08T00:00:00.000Z'),
    });

    const plan = await manager.createProposedPlan(createInput(goal.id));

    expect(plan).toMatchObject({
      id: 'proposed-plan:123',
      goalId: goal.id,
      revisionNumber: 1,
      revisionId: 'proposed-plan:123:rev:1',
      previousRevisionId: null,
      status: 'draft',
      contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
    });
    expect(plan.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('fails closed when the parent Goal does not exist', async () => {
    const manager = new ProposedPlanManager(new TestPlanStore(), async () => null, {
      createId: () => 'proposed-plan:missing-goal',
    });

    await expect(manager.createProposedPlan(createInput('goal:missing')))
      .rejects.toBeInstanceOf(GoalNotFoundForPlanError);
  });

  it('rejects plans above the configured task bound', async () => {
    const goal = createTestGoal({ id: 'goal:123' });
    const manager = new ProposedPlanManager(new TestPlanStore(), async () => goal, { maxTasks: 2 });

    await expect(manager.createProposedPlan(createInput(goal.id, [
      createTestTask('task:1'),
      createTestTask('task:2'),
      createTestTask('task:3'),
    ]))).rejects.toBeInstanceOf(InvalidProposedPlanInputError);
  });

  it('rejects dependency cycles', async () => {
    const goal = createTestGoal({ id: 'goal:123' });
    const manager = new ProposedPlanManager(new TestPlanStore(), async () => goal);

    await expect(manager.createProposedPlan(createInput(goal.id, [
      createTestTask('task:1', ['task:2']),
      createTestTask('task:2', ['task:1']),
    ]))).rejects.toBeInstanceOf(ProposedPlanDependencyError);
  });

  it('rejects a capability not authorized by the Goal', async () => {
    const goal = createTestGoal({
      id: 'goal:123',
      allowedCapabilities: ['allowed_cap'],
      constraints: { allowedCapabilities: ['allowed_cap'] },
    });
    const manager = new ProposedPlanManager(new TestPlanStore(), async () => goal);
    const input = { ...createInput(goal.id, []), requestedCapabilities: [{ capabilityId: 'not_allowed_cap' }] };

    await expect(manager.createProposedPlan(input)).rejects.toBeInstanceOf(ProposedPlanCapabilityDeniedError);
  });

  it('lists only proposals belonging to the requested Goal', async () => {
    const store = new TestPlanStore();
    const goals = new Map([
      ['goal:one', createTestGoal({ id: 'goal:one' })],
      ['goal:two', createTestGoal({ id: 'goal:two' })],
    ]);
    let nextId = 0;
    const manager = new ProposedPlanManager(store, async (goalId) => goals.get(goalId) ?? null, {
      createId: () => `proposed-plan:${++nextId}`,
    });

    await manager.createProposedPlan(createInput('goal:one'));
    await manager.createProposedPlan(createInput('goal:two'));

    const plans = await manager.listProposedPlansForGoal('goal:one');
    expect(plans).toHaveLength(1);
    expect(plans[0]?.goalId).toBe('goal:one');
  });
});
