import { UniversalGoal } from '../goal/goal-contract';
import { MissionTask, MissionTaskId } from '../mission/mission-types';
import { stableHash } from '../utils/hash';

/**
 * Version of the proposed plan contract.
 * Increment when making breaking changes to the ProposedPlan interface.
 */
export const PROPOSED_PLAN_CONTRACT_VERSION = 2 as const;

/**
 * Status of a proposed plan.
 */
export const PROPOSED_PLAN_STATUS = ['draft', 'validated', 'approved', 'rejected'] as const;
export type ProposedPlanStatus = typeof PROPOSED_PLAN_STATUS[number];

/**
 * Input for creating a proposed plan.
 * Note: the id is optional and will be generated if not provided.
 */
export interface CreateProposedPlanInput {
  /** The goal this plan is for. */
  goalId: string;
  /** A human-readable summary of the plan. */
  planSummary: string;
  /** The tasks that make up the plan. */
  planTasks: readonly MissionTask[];
  /** The capabilities that the plan requests to be authorized. */
  requestedCapabilities: readonly { capabilityId: string; version?: string }[];
  /** The expected evidence that the plan will produce. */
  expectedEvidence: readonly { key: string; description: string }[];
  /** Checkpoints where approval is required before proceeding. */
  approvalCheckpoints: readonly {
    /** The checkpoint description. */
    description: string;
    /** The task IDs that must be completed before this checkpoint is reached. */
    dependsOn: readonly MissionTaskId[];
  }[];
  /** Conditions that, when met, indicate the plan is complete. */
  completionConditions: readonly {
    /** The condition description. */
    description: string;
    /** The task IDs that must be completed for this condition to be met. */
    dependsOn: readonly MissionTaskId[];
  }[];
  /** Optional: the ID for the proposed plan. If not provided, one will be generated. */
  id?: string;
}

/**
 * A proposed plan for achieving a goal.
 * This is a proposal that must be approved by Efesto before execution.
 */
export interface ProposedPlan {
  /** The contract version of this proposed plan. */
  readonly contractVersion: typeof PROPOSED_PLAN_CONTRACT_VERSION;
  /** Unique identifier for the proposed plan. */
  readonly id: string;
  /** The goal this plan is for. */
  readonly goalId: string;
  /** A human-readable summary of the plan. */
  readonly planSummary: string;
  /** The tasks that make up the plan. */
  readonly planTasks: readonly MissionTask[];
  /** The capabilities that the plan requests to be authorized. */
  readonly requestedCapabilities: readonly { capabilityId: string; version?: string }[];
  /** The expected evidence that the plan will produce. */
  readonly expectedEvidence: readonly { key: string; description: string }[];
  /** Checkpoints where approval is required before proceeding. */
  readonly approvalCheckpoints: readonly {
    /** The checkpoint description. */
    readonly description: string;
    /** The task IDs that must be completed before this checkpoint is reached. */
    readonly dependsOn: readonly MissionTaskId[];
  }[];
  /** Conditions that, when met, indicate the plan is complete. */
  readonly completionConditions: readonly {
    /** The condition description. */
    readonly description: string;
    /** The task IDs that must be completed for this condition to be met. */
    readonly dependsOn: readonly MissionTaskId[];
  }[];
  /** The current status of the plan. */
  readonly status: ProposedPlanStatus;
  /** Monotonic revision number (starts at 1). */
  readonly revisionNumber: number;
  /** Identifier of the previous revision (null for the first revision). */
  readonly previousRevisionId: string | null;
  /** Identifier of this revision (unique, e.g., UUID or hash-based). */
  readonly revisionId: string;
  /** Hash of the canonical content (excludes mutables like timestamps, status, revision fields). */
  readonly contentHash: string;
  /** Timestamp when the plan was created. */
  readonly createdAt: string; // ISO 8601
  /** Timestamp when the plan was last updated. */
  readonly updatedAt: string; // ISO 8601
  /** Revision tracking for when the plan was created. */
  readonly createdRevision: {
    /** The revision number. */
    readonly revision: number;
    /** Timestamp when this revision was created. */
    readonly changedAt: string; // ISO 8601
    /** Who or what caused this change. */
    readonly changedBy: string;
    /** A diff of what changed (for simplicity, we store an empty object). */
    readonly diff: Record<string, unknown>;
  };
  /** Revision tracking for the current version of the plan. */
  readonly currentRevision: {
    /** The revision number. */
    readonly revision: number;
    /** Timestamp when this revision was created. */
    readonly changedAt: string; // ISO 8601
    /** Who or what caused this change. */
    readonly changedBy: string;
    /** A diff of what changed (for simplicity, we store an empty object). */
    readonly diff: Record<string, unknown>;
  };
}

/**
 * Computes a deterministic SHA-256 hash of the canonical content of a proposed plan.
 * The hash excludes fields that change on every update (timestamps, status, revision fields, contentHash).
 */
export function computeProposedPlanHash(plan: Pick<ProposedPlan, 
  | 'goalId'
  | 'planSummary'
  | 'planTasks'
  | 'requestedCapabilities'
  | 'expectedEvidence'
  | 'approvalCheckpoints'
  | 'completionConditions'>): string {
  const hashable = {
    goalId: plan.goalId,
    planSummary: plan.planSummary,
    planTasks: plan.planTasks,
    requestedCapabilities: plan.requestedCapabilities,
    expectedEvidence: plan.expectedEvidence,
    approvalCheckpoints: plan.approvalCheckpoints,
    completionConditions: plan.completionConditions,
  };
  return stableHash(hashable);
}