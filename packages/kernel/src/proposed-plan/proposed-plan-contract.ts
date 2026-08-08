import type { MissionTask, MissionTaskId } from '../mission/mission-types';
import { stableHash } from '../utils/hash';

export const PROPOSED_PLAN_CONTRACT_VERSION = 2 as const;

export const PROPOSED_PLAN_STATUS = ['draft', 'validated', 'approved', 'rejected'] as const;
export type ProposedPlanStatus = (typeof PROPOSED_PLAN_STATUS)[number];

export interface RequestedCapability {
  readonly capabilityId: string;
  readonly version?: string;
}

export interface ExpectedEvidence {
  readonly key: string;
  readonly description: string;
}

export interface PlanDependencyCheckpoint {
  readonly description: string;
  readonly dependsOn: readonly MissionTaskId[];
}

export interface CreateProposedPlanInput {
  readonly goalId: string;
  readonly planSummary: string;
  readonly planTasks: readonly MissionTask[];
  readonly requestedCapabilities: readonly RequestedCapability[];
  readonly expectedEvidence: readonly ExpectedEvidence[];
  readonly approvalCheckpoints: readonly PlanDependencyCheckpoint[];
  readonly completionConditions: readonly PlanDependencyCheckpoint[];
  readonly id?: string;
  readonly changedBy?: string;
}

/**
 * Only proposal content is mutable through the plan manager. Identity, Goal
 * binding, status, revision metadata and authority fields are intentionally
 * absent. Status/approval transitions belong to a separate authority boundary.
 */
export interface UpdateProposedPlanInput {
  readonly expectedRevisionId: string;
  readonly planSummary?: string;
  readonly planTasks?: readonly MissionTask[];
  readonly requestedCapabilities?: readonly RequestedCapability[];
  readonly expectedEvidence?: readonly ExpectedEvidence[];
  readonly approvalCheckpoints?: readonly PlanDependencyCheckpoint[];
  readonly completionConditions?: readonly PlanDependencyCheckpoint[];
  readonly changedBy?: string;
}

export interface ProposedPlanRevisionMetadata {
  readonly revision: number;
  readonly changedAt: string;
  readonly changedBy: string;
  readonly diff: Readonly<Record<string, unknown>>;
}

/**
 * An immutable revision of a proposal for achieving one Goal.
 * This contract carries no execution authority.
 */
export interface ProposedPlan {
  readonly contractVersion: typeof PROPOSED_PLAN_CONTRACT_VERSION;
  readonly id: string;
  readonly goalId: string;
  readonly planSummary: string;
  readonly planTasks: readonly MissionTask[];
  readonly requestedCapabilities: readonly RequestedCapability[];
  readonly expectedEvidence: readonly ExpectedEvidence[];
  readonly approvalCheckpoints: readonly PlanDependencyCheckpoint[];
  readonly completionConditions: readonly PlanDependencyCheckpoint[];
  readonly status: ProposedPlanStatus;
  readonly revisionNumber: number;
  readonly previousRevisionId: string | null;
  readonly revisionId: string;
  readonly contentHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdRevision: ProposedPlanRevisionMetadata;
  readonly currentRevision: ProposedPlanRevisionMetadata;
}

export type ProposedPlanHashInput = Pick<
  ProposedPlan,
  | 'goalId'
  | 'planSummary'
  | 'planTasks'
  | 'requestedCapabilities'
  | 'expectedEvidence'
  | 'approvalCheckpoints'
  | 'completionConditions'
>;

export function computeProposedPlanHash(plan: ProposedPlanHashInput): string {
  return stableHash({
    goalId: plan.goalId,
    planSummary: plan.planSummary,
    planTasks: plan.planTasks,
    requestedCapabilities: plan.requestedCapabilities,
    expectedEvidence: plan.expectedEvidence,
    approvalCheckpoints: plan.approvalCheckpoints,
    completionConditions: plan.completionConditions,
  });
}
