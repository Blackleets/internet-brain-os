import { describe, expect, it } from 'vitest';
import type { UniversalGoal } from '../goal/goal-contract';
import { GOAL_CONTRACT_VERSION } from '../goal/goal-contract';
import type { MissionTask, MissionTaskId } from '../mission/mission-types';
import type { ProposedPlan, UpdateProposedPlanInput } from './proposed-plan-contract';
import { ProposedPlanManager, type ProposedPlanStore } from './proposed-plan-manager';
import {
  InvalidProposedPlanInputError,
  ProposedPlanCapabilityDeniedError,
  ProposedPlanDependencyError,
  ProposedPlanRevisionConflictError,
} from './proposed-plan-errors';

class InMemoryProposedPlanStore implements ProposedPlanStore {
  private plans: ProposedPlan[] = [];

  async transaction<T>(callback: (plans: ProposedPlan[]) => Promise<T>): Promise<T> {
    return callback(this.plans.map((plan) => structuredClone(plan)));
  }

  async write(plans: ProposedPlan[]): Promise<void> {
    this.plans = plans.map((plan) => structuredClone(plan));
  }
}

function goal(overrides: Partial<UniversalGoal> = {}): UniversalGoal {
  const now = '2026-08-08T00:00:00.000Z';
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:one',
    title: 'Find useful work',
    desiredOutcome: 'Find relevant public opportunities',
    successCriteria: ['At least one relevant finding'],
    constraints: { allowedCapabilities: ['public_web_research'] },
    frequency: 'once',
    allowedCapabilities: ['public_web_research'],
    forbiddenCapabilities: ['purchase'],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function task(id = 'task:one', dependsOn: readonly string[] = []): MissionTask {
  return {
    id: id as MissionTaskId,
    title: id,
    objective: `Complete ${id}`,
    status: 'pending',
    dependsOn: dependsOn.map((dependency) => dependency as MissionTaskId),
    evidenceRequirements: [{ key: `${id}:evidence`, description: 'Public evidence', required: true }],
  };
}

function input(planTasks: readonly MissionTask[] = [task('task:one')]) {
  return {
    id: 'proposed-plan:one',
    goalId: 'goal:one',
    planSummary: 'Research public sources',
    planTasks,
    requestedCapabilities: [{ capabilityId: 'public_web_research' }],
    expectedEvidence: [{ key: 'public-source', description: 'A public source' }],
    approvalCheckpoints: [],
    completionConditions: [{ description: 'Research complete', dependsOn: [planTasks[0]!.id] }],
  };
}

function managerFor(currentGoal = goal()) {
  return new ProposedPlanManager(
    new InMemoryProposedPlanStore(),
    async (goalId) => goalId === currentGoal.id ? currentGoal : null,
    {
      now: () => new Date('2026-08-08T00:00:00.000Z'),
      createId: () => 'proposed-plan:generated',
    },
  );
}

describe('ProposedPlanManager authority hardening', () => {
  it('Given a plan revision, When it is updated, Then history is append-only and linked', async () => {
    const manager = managerFor();
    const created = await manager.createProposedPlan(input());
    const updated = await manager.updateProposedPlan(created.id, {
      expectedRevisionId: created.revisionId,
      planSummary: 'Research and compare public sources',
      changedBy: 'founder',
    });

    expect(updated).toMatchObject({
      id: created.id,
      goalId: created.goalId,
      revisionNumber: 2,
      previousRevisionId: created.revisionId,
      revisionId: `${created.id}:rev:2`,
    });
    const history = await manager.getProposedPlanHistory(created.id);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(created);
    expect(history[1]).toEqual(updated);
  });

  it('Given a stale expected revision, When an update is attempted, Then it fails closed without appending', async () => {
    const manager = managerFor();
    const created = await manager.createProposedPlan(input());

    await expect(manager.updateProposedPlan(created.id, {
      expectedRevisionId: 'stale-revision',
      planSummary: 'Stale update',
    })).rejects.toBeInstanceOf(ProposedPlanRevisionConflictError);

    expect(await manager.getProposedPlanHistory(created.id)).toHaveLength(1);
  });

  it('Given a forged goalId in a runtime update payload, When the manager applies the update, Then Goal identity remains immutable', async () => {
    const manager = managerFor();
    const created = await manager.createProposedPlan(input());
    const forged = {
      expectedRevisionId: created.revisionId,
      planSummary: 'Still bound to the original Goal',
      goalId: 'goal:attacker',
    } as unknown as UpdateProposedPlanInput;

    const updated = await manager.updateProposedPlan(created.id, forged);

    expect(updated.goalId).toBe('goal:one');
    expect((await manager.getProposedPlanHistory(created.id)).every((revision) => revision.goalId === 'goal:one')).toBe(true);
  });

  it('Given mutable caller-owned task arrays, When the caller mutates them after creation, Then stored history is unchanged', async () => {
    const tasks = [task('task:one')];
    const manager = managerFor();
    const created = await manager.createProposedPlan(input(tasks));

    tasks.push(task('task:two'));
    (tasks[0]!.dependsOn as MissionTaskId[]).push('task:forged' as MissionTaskId);

    const persisted = await manager.getProposedPlan(created.id);
    expect(persisted?.planTasks).toHaveLength(1);
    expect(persisted?.planTasks[0]?.dependsOn).toEqual([]);
    expect(persisted?.contentHash).toBe(created.contentHash);
  });

  it('Given duplicate task identities, When a plan is created, Then the plan is rejected', async () => {
    const manager = managerFor();

    await expect(manager.createProposedPlan(input([
      task('task:duplicate'),
      task('task:duplicate'),
    ]))).rejects.toBeInstanceOf(InvalidProposedPlanInputError);
  });

  it('Given an unknown dependency, When a plan is created, Then dependency validation fails closed', async () => {
    const manager = managerFor();

    await expect(manager.createProposedPlan(input([
      task('task:one', ['task:missing']),
    ]))).rejects.toBeInstanceOf(ProposedPlanDependencyError);
  });

  it('Given the Goal does not explicitly allow a capability, When the plan requests it, Then capability validation denies it', async () => {
    const manager = managerFor(goal({ allowedCapabilities: [], constraints: { allowedCapabilities: [] } }));

    await expect(manager.createProposedPlan(input())).rejects.toBeInstanceOf(ProposedPlanCapabilityDeniedError);
  });
});
