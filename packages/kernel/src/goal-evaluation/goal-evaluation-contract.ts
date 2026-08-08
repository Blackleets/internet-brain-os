import type { MissionTaskId } from '../mission/mission-types';

export type GoalEvaluationStatus = 'completed' | 'continue' | 'waiting' | 'blocked';
export type GoalNextAction = 'none' | 'new_plan_revision' | 'await_trigger' | 'human_review';

export interface GoalEvaluationInput {
  readonly goalId: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly taskStatuses: Readonly<Record<string, 'pending' | 'ready' | 'active' | 'completed' | 'failed'>>;
  readonly satisfiedCompletionConditions: readonly string[];
  readonly blockers?: readonly string[];
  readonly waitingFor?: string;
  readonly evaluatedAt: string;
}

export interface GoalEvaluation {
  readonly id: string;
  readonly goalId: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly status: GoalEvaluationStatus;
  readonly nextAction: GoalNextAction;
  readonly reasons: readonly string[];
  readonly incompleteTaskIds: readonly MissionTaskId[];
  readonly evaluatedAt: string;
  readonly inputHash: string;
}
