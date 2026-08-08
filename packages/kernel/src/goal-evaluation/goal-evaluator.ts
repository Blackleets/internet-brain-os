import { createHash } from 'node:crypto';
import type { MissionTaskId } from '../mission/mission-types';
import type { ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import type { GoalEvaluation, GoalEvaluationInput } from './goal-evaluation-contract';

export interface GoalEvaluationStore {
  transaction<T>(callback: (evaluations: readonly GoalEvaluation[]) => Promise<T>): Promise<T>;
  write(evaluations: readonly GoalEvaluation[]): Promise<void>;
}

export class GoalEvaluationError extends Error {
  readonly code = 'GOAL_EVALUATION_ERROR';
  constructor(message: string) { super(message); this.name = 'GoalEvaluationError'; }
}

export class GoalEvaluator {
  constructor(private readonly store: GoalEvaluationStore) {}

  async evaluate(plan: ProposedPlan, input: GoalEvaluationInput): Promise<GoalEvaluation> {
    validateBinding(plan, input);
    const normalized = normalizeInput(plan, input);
    const inputHash = hash(stableStringify(normalized));
    const id = `goal-evaluation:${hash(`${plan.revisionId}:${inputHash}`).slice(0, 24)}`;
    const evaluation = decide(plan, normalized, id, inputHash);

    return this.store.transaction(async (evaluations) => {
      const existing = evaluations.find((candidate) => candidate.id === id);
      if (existing) return clone(existing);
      await this.store.write([...evaluations.map(clone), clone(evaluation)]);
      return clone(evaluation);
    });
  }
}

function decide(plan: ProposedPlan, input: GoalEvaluationInput, id: string, inputHash: string): GoalEvaluation {
  const taskStatuses = input.taskStatuses;
  const incompleteTaskIds = plan.planTasks
    .filter((task) => taskStatuses[String(task.id)] !== 'completed')
    .map((task) => task.id);
  const failedTaskIds = plan.planTasks
    .filter((task) => taskStatuses[String(task.id)] === 'failed')
    .map((task) => task.id);
  const satisfied = new Set(input.satisfiedCompletionConditions);
  const missingConditions = plan.completionConditions
    .map((condition) => condition.description)
    .filter((description) => !satisfied.has(description));
  const blockers = [...(input.blockers ?? [])];

  if (blockers.length) return build('blocked', 'human_review', [...blockers], incompleteTaskIds);
  if (input.waitingFor) return build('waiting', 'await_trigger', [input.waitingFor], incompleteTaskIds);
  if (!incompleteTaskIds.length && !missingConditions.length) return build('completed', 'none', ['All tasks and completion conditions are satisfied'], []);

  const reasons = [
    ...failedTaskIds.map((taskId) => `Task failed: ${String(taskId)}`),
    ...incompleteTaskIds.filter((taskId) => !failedTaskIds.includes(taskId)).map((taskId) => `Task incomplete: ${String(taskId)}`),
    ...missingConditions.map((condition) => `Completion condition not satisfied: ${condition}`),
  ];
  return build('continue', 'new_plan_revision', reasons.length ? reasons : ['Goal requires further work'], incompleteTaskIds);

  function build(
    status: GoalEvaluation['status'],
    nextAction: GoalEvaluation['nextAction'],
    reasons: readonly string[],
    incomplete: readonly MissionTaskId[],
  ): GoalEvaluation {
    return {
      id, goalId: input.goalId, planId: input.planId, revisionId: input.revisionId,
      status, nextAction, reasons: [...reasons], incompleteTaskIds: [...incomplete], evaluatedAt: input.evaluatedAt, inputHash,
    };
  }
}

function validateBinding(plan: ProposedPlan, input: GoalEvaluationInput): void {
  if (plan.id !== input.planId || plan.goalId !== input.goalId || plan.revisionId !== input.revisionId) {
    throw new GoalEvaluationError('Goal evaluation must bind the exact Goal, plan and revision');
  }
}
function normalizeInput(plan: ProposedPlan, input: GoalEvaluationInput): GoalEvaluationInput {
  requireIso(input.evaluatedAt);
  const taskStatuses: Record<string, GoalEvaluationInput['taskStatuses'][string]> = {};
  for (const task of plan.planTasks) {
    const status = input.taskStatuses[String(task.id)];
    if (!status) throw new GoalEvaluationError(`Missing status for task ${String(task.id)}`);
    taskStatuses[String(task.id)] = status;
  }
  const blockers = [...new Set((input.blockers ?? []).map(clean).filter(Boolean))].sort();
  const satisfiedCompletionConditions = [...new Set(input.satisfiedCompletionConditions.map(clean).filter(Boolean))].sort();
  return {
    goalId: clean(input.goalId), planId: clean(input.planId), revisionId: clean(input.revisionId), taskStatuses,
    satisfiedCompletionConditions, ...(blockers.length ? { blockers } : {}), ...(input.waitingFor ? { waitingFor: clean(input.waitingFor) } : {}),
    evaluatedAt: input.evaluatedAt,
  };
}
function clone(evaluation: GoalEvaluation): GoalEvaluation { return { ...evaluation, reasons: [...evaluation.reasons], incompleteTaskIds: [...evaluation.incompleteTaskIds] }; }
function clean(value: string): string { return typeof value === 'string' ? value.trim() : ''; }
function requireIso(value: string): void { if (!Number.isFinite(Date.parse(value))) throw new GoalEvaluationError('evaluatedAt must be an ISO datetime'); }
function stableStringify(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') { const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)); return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`; } return JSON.stringify(value); }
function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
