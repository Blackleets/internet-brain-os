import type { ProposedPlanManager } from '../proposed-plan/proposed-plan-manager';
import type { ProposedPlan, UpdateProposedPlanInput } from '../proposed-plan/proposed-plan-contract';
import type { GoalEvaluation } from './goal-evaluation-contract';
import { GoalEvaluationError } from './goal-evaluator';

export type ReplanProposal = Omit<UpdateProposedPlanInput, 'expectedRevisionId'>;

export class GoalReplanningService {
  constructor(private readonly plans: ProposedPlanManager) {}

  async createNextRevision(evaluation: GoalEvaluation, proposal: ReplanProposal): Promise<ProposedPlan> {
    if (evaluation.status !== 'continue' || evaluation.nextAction !== 'new_plan_revision') {
      throw new GoalEvaluationError(`Evaluation ${evaluation.id} does not authorize replanning`);
    }
    return this.plans.updateProposedPlan(evaluation.planId, {
      ...proposal,
      expectedRevisionId: evaluation.revisionId,
      changedBy: proposal.changedBy ?? 'goal-evaluator',
    });
  }
}
