import type { UniversalGoal } from '../goal/goal-contract';
import type {
  CreateProposedPlanInput,
  ProposedPlan,
  UpdateProposedPlanInput,
} from '../proposed-plan/proposed-plan-contract';
import { GoalNotFoundForPlanError, ProposedPlanNotFoundError } from '../proposed-plan/proposed-plan-errors';
import type { ProposedPlanManager } from '../proposed-plan/proposed-plan-manager';
import type { CapabilityAuthorizationContext, CapabilityRequest } from './capability-contract';
import { CapabilityRegistry } from './capability-registry';

export class CapabilityGatedProposedPlanService {
  constructor(
    private readonly plans: ProposedPlanManager,
    private readonly capabilities: CapabilityRegistry,
    private readonly getGoal: (goalId: string) => Promise<UniversalGoal | null>,
  ) {}

  async create(input: CreateProposedPlanInput): Promise<ProposedPlan> {
    const goal = await this.getGoal(input.goalId);
    if (!goal) throw new GoalNotFoundForPlanError(input.id ?? 'unknown', input.goalId);
    this.authorizeRequests(input.requestedCapabilities, goal, input.id ?? 'pending');
    return this.plans.createProposedPlan(input);
  }

  async update(planId: string, input: UpdateProposedPlanInput): Promise<ProposedPlan> {
    const current = await this.plans.getProposedPlan(planId);
    if (!current) throw new ProposedPlanNotFoundError(planId);
    const goal = await this.getGoal(current.goalId);
    if (!goal) throw new GoalNotFoundForPlanError(planId, current.goalId);
    this.authorizeRequests(input.requestedCapabilities ?? current.requestedCapabilities, goal, planId);
    return this.plans.updateProposedPlan(planId, input);
  }

  private authorizeRequests(requests: readonly CapabilityRequest[], goal: UniversalGoal, planId: string): void {
    const context: CapabilityAuthorizationContext = {
      planId,
      goalAllowedCapabilities: intersection(
        goal.allowedCapabilities ?? [],
        goal.constraints?.allowedCapabilities ?? [],
      ),
      goalForbiddenCapabilities: unique([
        ...(goal.forbiddenCapabilities ?? []),
        ...(goal.constraints?.forbiddenCapabilities ?? []),
      ]),
      goalAllowedDataScopes: intersection(
        goal.allowedDataScopes ?? [],
        goal.constraints?.allowedDataScopes ?? [],
      ),
      goalForbiddenDataScopes: unique([
        ...(goal.constraints?.forbiddenDataScopes ?? []),
      ]),
    };
    for (const request of requests) this.capabilities.authorize(request, context);
  }
}

function intersection(primary: readonly string[], constrained: readonly string[]): readonly string[] {
  if (constrained.length === 0) return unique(primary);
  const allowed = new Set(constrained);
  return unique(primary.filter((value) => allowed.has(value)));
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
