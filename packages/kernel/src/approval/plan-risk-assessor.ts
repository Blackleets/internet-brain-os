import type { UniversalGoal } from '../goal/goal-contract';
import type { ProposedPlan } from '../proposed-plan/proposed-plan-contract';
import { CapabilityRegistry } from '../capability/capability-registry';
import type { CapabilityAuthorizationContext, CapabilityRiskLevel } from '../capability/capability-contract';
import type { ApprovalRequirement, CapabilityRiskAssessment, PlanRiskAssessment } from './approval-contract';

const RISK_ORDER: readonly CapabilityRiskLevel[] = ['r0_observe', 'r1_reversible', 'r2_external', 'r3_irreversible'];
const APPROVAL_ORDER: readonly ApprovalRequirement[] = ['none', 'policy', 'explicit'];

export class PlanRiskAssessor {
  constructor(private readonly capabilities: CapabilityRegistry) {}

  assess(plan: ProposedPlan, goal: UniversalGoal): PlanRiskAssessment {
    const context = authorizationContext(plan.id, goal);
    const assessments = plan.requestedCapabilities.map((request) => {
      const authorized = this.capabilities.authorize(request, context);
      const reasons: string[] = [`risk:${authorized.definition.riskLevel}`];
      let approvalRequirement = riskRequirement(authorized.definition.riskLevel);

      if (authorized.definition.consentPolicy === 'always') {
        approvalRequirement = maxApproval(approvalRequirement, 'explicit');
        reasons.push('capability_consent:always');
      } else if (authorized.definition.consentPolicy === 'policy') {
        approvalRequirement = maxApproval(approvalRequirement, 'policy');
        reasons.push('capability_consent:policy');
      }

      const goalRequirement = goalApprovalRequirement(goal.approvalConfig.policy);
      approvalRequirement = maxApproval(approvalRequirement, goalRequirement);
      if (goalRequirement !== 'none') reasons.push(`goal_approval:${goal.approvalConfig.policy}`);

      return {
        capabilityId: authorized.definition.id,
        riskLevel: authorized.definition.riskLevel,
        approvalRequirement,
        reasons,
      } satisfies CapabilityRiskAssessment;
    });

    return {
      planId: plan.id,
      highestRisk: assessments.reduce<CapabilityRiskLevel>((highest, item) => (
        RISK_ORDER.indexOf(item.riskLevel) > RISK_ORDER.indexOf(highest) ? item.riskLevel : highest
      ), 'r0_observe'),
      approvalRequirement: assessments.reduce<ApprovalRequirement>((highest, item) => (
        maxApproval(highest, item.approvalRequirement)
      ), goalApprovalRequirement(goal.approvalConfig.policy)),
      capabilities: assessments,
    };
  }
}

function riskRequirement(risk: CapabilityRiskLevel): ApprovalRequirement {
  switch (risk) {
    case 'r0_observe': return 'none';
    case 'r1_reversible': return 'policy';
    case 'r2_external':
    case 'r3_irreversible': return 'explicit';
  }
}

function goalApprovalRequirement(policy: UniversalGoal['approvalConfig']['policy']): ApprovalRequirement {
  switch (policy) {
    case 'none': return 'none';
    case 'checkpoints':
    case 'custom': return 'policy';
    case 'all_actions': return 'explicit';
  }
}

function maxApproval(left: ApprovalRequirement, right: ApprovalRequirement): ApprovalRequirement {
  return APPROVAL_ORDER.indexOf(right) > APPROVAL_ORDER.indexOf(left) ? right : left;
}

function authorizationContext(planId: string, goal: UniversalGoal): CapabilityAuthorizationContext {
  const constrainedCapabilities = goal.constraints?.allowedCapabilities ?? [];
  const constrainedScopes = goal.constraints?.allowedDataScopes ?? [];
  return {
    planId,
    goalAllowedCapabilities: constrainedCapabilities.length === 0
      ? [...(goal.allowedCapabilities ?? [])]
      : [...(goal.allowedCapabilities ?? [])].filter((capability) => constrainedCapabilities.includes(capability)),
    goalForbiddenCapabilities: [...new Set([
      ...(goal.forbiddenCapabilities ?? []),
      ...(goal.constraints?.forbiddenCapabilities ?? []),
    ])],
    goalAllowedDataScopes: constrainedScopes.length === 0
      ? [...(goal.allowedDataScopes ?? [])]
      : [...(goal.allowedDataScopes ?? [])].filter((scope) => constrainedScopes.includes(scope)),
    goalForbiddenDataScopes: [...new Set(goal.constraints?.forbiddenDataScopes ?? [])],
  };
}
