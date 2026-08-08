import { describe, expect, test } from 'vitest';
import { GOAL_CONTRACT_VERSION, type UniversalGoal } from '../goal/goal-contract';
import type { MissionTaskId } from '../mission/mission-types';
import { PROPOSED_PLAN_CONTRACT_VERSION, type ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { ProposedPlanManager, type ProposedPlanStore } from '../proposed-plan/proposed-plan-manager';
import { GoalEvaluator, GoalEvaluationError, type GoalEvaluationStore } from './goal-evaluator';
import type { GoalEvaluation } from './goal-evaluation-contract';
import { GoalReplanningService } from './goal-replanning-service';

const now = '2026-08-08T15:00:00.000Z';
const taskId = 'task:1' as MissionTaskId;
function plan(): ProposedPlan {
  return {
    contractVersion: PROPOSED_PLAN_CONTRACT_VERSION, id: 'plan:1', goalId: 'goal:1', planSummary: 'Find a qualifying result',
    planTasks: [{ id: taskId, title: 'Research', objective: 'Find result', status: 'pending', dependsOn: [], evidenceRequirements: [] }],
    requestedCapabilities: [], expectedEvidence: [], approvalCheckpoints: [], completionConditions: [{ description: 'Candidate verified', dependsOn: [taskId] }],
    status: 'draft', revisionNumber: 1, previousRevisionId: null, revisionId: 'plan:1:rev:1', contentHash: 'hash', createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} }, currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}
function evaluationStore(): GoalEvaluationStore {
  let evaluations: GoalEvaluation[] = [];
  return { transaction: async (callback) => callback(evaluations), write: async (next) => { evaluations = next.map((item) => ({ ...item, reasons: [...item.reasons], incompleteTaskIds: [...item.incompleteTaskIds] })); } };
}
function input(overrides: Record<string, unknown> = {}) {
  return { goalId: 'goal:1', planId: 'plan:1', revisionId: 'plan:1:rev:1', taskStatuses: { 'task:1': 'completed' as const }, satisfiedCompletionConditions: ['Candidate verified'], evaluatedAt: now, ...overrides };
}

describe('GoalEvaluator', () => {
  test('marks a Goal completed only when tasks and declared completion conditions are satisfied', async () => {
    const evaluator = new GoalEvaluator(evaluationStore());
    await expect(evaluator.evaluate(plan(), input())).resolves.toMatchObject({ status: 'completed', nextAction: 'none' });
  });

  test('waiting routes through a trigger and blockers route to human review', async () => {
    const evaluator = new GoalEvaluator(evaluationStore());
    await expect(evaluator.evaluate(plan(), input({ taskStatuses: { 'task:1': 'pending' }, satisfiedCompletionConditions: [], waitingFor: 'price below 20' })))
      .resolves.toMatchObject({ status: 'waiting', nextAction: 'await_trigger' });
    await expect(evaluator.evaluate(plan(), input({ taskStatuses: { 'task:1': 'failed' }, satisfiedCompletionConditions: [], blockers: ['Missing owner approval'] })))
      .resolves.toMatchObject({ status: 'blocked', nextAction: 'human_review' });
  });

  test('incomplete or failed work requests a new immutable plan revision', async () => {
    const evaluator = new GoalEvaluator(evaluationStore());
    const result = await evaluator.evaluate(plan(), input({ taskStatuses: { 'task:1': 'failed' }, satisfiedCompletionConditions: [] }));
    expect(result).toMatchObject({ status: 'continue', nextAction: 'new_plan_revision', revisionId: 'plan:1:rev:1' });
  });

  test('missing task status or altered revision binding fails closed', async () => {
    const evaluator = new GoalEvaluator(evaluationStore());
    await expect(evaluator.evaluate(plan(), input({ taskStatuses: {} }))).rejects.toThrow(GoalEvaluationError);
    await expect(evaluator.evaluate(plan(), input({ revisionId: 'plan:1:rev:evil' }))).rejects.toThrow(GoalEvaluationError);
  });
});

class TestPlanStore implements ProposedPlanStore {
  plans: ProposedPlan[] = [];
  async transaction<T>(callback: (plans: ProposedPlan[]) => Promise<T>): Promise<T> { return callback(structuredClone(this.plans)); }
  async write(plans: ProposedPlan[]): Promise<void> { this.plans = structuredClone(plans); }
}
function goal(): UniversalGoal {
  return {
    contractVersion: GOAL_CONTRACT_VERSION, id: 'goal:1', title: 'Goal', desiredOutcome: 'Find result', successCriteria: ['Candidate verified'], constraints: { allowedCapabilities: [] },
    allowedCapabilities: [], forbiddenCapabilities: [], allowedDataScopes: [], forbiddenActions: [], autonomyLevel: 'assisted', approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' }, memoryConfig: { policy: 'none' }, terminationConditions: [], status: 'active', createdAt: now, updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} }, currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}

describe('GoalReplanningService', () => {
  test('continue evaluation creates a new append-only plan revision instead of rewriting history', async () => {
    const store = new TestPlanStore();
    const manager = new ProposedPlanManager(store, async () => goal(), { createId: () => 'plan:1', now: () => new Date(now) });
    const first = await manager.createProposedPlan({ goalId: 'goal:1', planSummary: 'Initial plan', planTasks: plan().planTasks, requestedCapabilities: [], expectedEvidence: [], approvalCheckpoints: [], completionConditions: plan().completionConditions });
    const evaluation = await new GoalEvaluator(evaluationStore()).evaluate(first, { ...input(), revisionId: first.revisionId, taskStatuses: { 'task:1': 'failed' }, satisfiedCompletionConditions: [] });
    const next = await new GoalReplanningService(manager).createNextRevision(evaluation, { planSummary: 'Revised plan after failed task' });
    expect(next.revisionNumber).toBe(2);
    expect(next.previousRevisionId).toBe(first.revisionId);
    expect(await manager.getProposedPlanHistory(first.id)).toHaveLength(2);
  });

  test('completed evaluation cannot be used to revise a plan', async () => {
    const fakeManager = {} as ProposedPlanManager;
    const service = new GoalReplanningService(fakeManager);
    const completed = await new GoalEvaluator(evaluationStore()).evaluate(plan(), input());
    await expect(service.createNextRevision(completed, { planSummary: 'Should not happen' })).rejects.toThrow(GoalEvaluationError);
  });
});
