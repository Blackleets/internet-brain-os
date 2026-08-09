import {
  CAPABILITY_CONSENT_POLICIES,
  CAPABILITY_HEALTH_STATES,
  CAPABILITY_RISK_LEVELS,
  type AuthorizedCapability,
} from '../capability/capability-contract';
import { APPROVAL_POLICY, GOAL_STATUS, type ApprovalPolicy, type GoalStatus } from './goal-contract';

export const AUTOMATIC_READ_ONLY_POLICY_VERSION = 'efesto.automatic-read-only-policy.v1' as const;
export const GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION = 'efesto.goal-execution-authorization.v1' as const;

export const GOAL_EXECUTION_AUTHORIZATION_SCOPES = ['read_only_continuation', 'single_action'] as const;
export type GoalExecutionAuthorizationScope = (typeof GOAL_EXECUTION_AUTHORIZATION_SCOPES)[number];

export const GOAL_EXECUTION_AUTHORIZATION_ACTORS = ['human', 'founder', 'agent', 'system'] as const;
export type GoalExecutionAuthorizationActor = (typeof GOAL_EXECUTION_AUTHORIZATION_ACTORS)[number];

export interface GoalExecutionAuthorizationReceipt {
  readonly schemaVersion: typeof GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION;
  readonly id: string;
  readonly goalId: string;
  readonly goalRevision: number;
  readonly decision: 'approved' | 'rejected';
  readonly scope: GoalExecutionAuthorizationScope;
  readonly actorType: GoalExecutionAuthorizationActor;
  readonly decidedBy: string;
  readonly decidedAt: string;
}

export interface AutomaticReadOnlyGoalContext {
  readonly id: string;
  readonly revision: number;
  readonly status: GoalStatus;
  readonly approvalPolicy: ApprovalPolicy | 'legacy_none';
}

export interface AutomaticReadOnlyContinuationInput {
  readonly goal: AutomaticReadOnlyGoalContext;
  readonly authorization?: GoalExecutionAuthorizationReceipt;
  readonly capability: AuthorizedCapability;
}

export const AUTOMATIC_READ_ONLY_DENIAL_REASONS = [
  'invalid_input',
  'goal_not_active',
  'authorization_missing',
  'authorization_rejected',
  'authorization_actor_not_human',
  'authorization_goal_mismatch',
  'authorization_revision_mismatch',
  'authorization_scope_mismatch',
  'goal_requires_fresh_approval',
  'capability_unavailable',
  'capability_not_read_only',
  'capability_requires_fresh_consent',
] as const;
export type AutomaticReadOnlyDenialReason = (typeof AUTOMATIC_READ_ONLY_DENIAL_REASONS)[number];

export type AutomaticReadOnlyDecision =
  | {
    readonly policyVersion: typeof AUTOMATIC_READ_ONLY_POLICY_VERSION;
    readonly allowed: true;
    readonly reason: 'eligible';
    readonly goalId: string;
    readonly capabilityId: string;
    readonly authorizationRef: string;
  }
  | {
    readonly policyVersion: typeof AUTOMATIC_READ_ONLY_POLICY_VERSION;
    readonly allowed: false;
    readonly reason: AutomaticReadOnlyDenialReason;
  };

/**
 * Decides only whether already-authorized R0 work may continue without another prompt.
 * It does not authorize a capability, create a Mission, approve a side effect, or mutate memory authority.
 */
export function evaluateAutomaticReadOnlyContinuation(input: unknown): AutomaticReadOnlyDecision {
  const parsed = parseInput(input);
  if (!parsed) return deny('invalid_input');

  if (parsed.goal.status !== 'active') return deny('goal_not_active');

  const receipt = parsed.authorization;
  if (!receipt) return deny('authorization_missing');
  if (receipt.decision !== 'approved') return deny('authorization_rejected');
  if (receipt.actorType !== 'human' && receipt.actorType !== 'founder') return deny('authorization_actor_not_human');
  if (receipt.goalId !== parsed.goal.id) return deny('authorization_goal_mismatch');
  if (receipt.goalRevision !== parsed.goal.revision) return deny('authorization_revision_mismatch');
  if (receipt.scope !== 'read_only_continuation') return deny('authorization_scope_mismatch');

  if (parsed.goal.approvalPolicy === 'all_actions' || parsed.goal.approvalPolicy === 'custom') {
    return deny('goal_requires_fresh_approval');
  }

  const definition = parsed.capability.definition;
  if (definition.health !== 'available') return deny('capability_unavailable');
  if (definition.riskLevel !== 'r0_observe') return deny('capability_not_read_only');
  if (definition.consentPolicy === 'always') return deny('capability_requires_fresh_consent');

  return {
    policyVersion: AUTOMATIC_READ_ONLY_POLICY_VERSION,
    allowed: true,
    reason: 'eligible',
    goalId: parsed.goal.id,
    capabilityId: definition.id,
    authorizationRef: receipt.id,
  };
}

function parseInput(value: unknown): AutomaticReadOnlyContinuationInput | null {
  if (!isRecord(value) || !isRecord(value.goal) || !isRecord(value.capability) || !isRecord(value.capability.definition)) return null;

  const goalId = cleanString(value.goal.id);
  const revision = positiveInteger(value.goal.revision);
  const status = value.goal.status;
  const approvalPolicy = value.goal.approvalPolicy;
  if (!goalId || revision === null || !GOAL_STATUS.includes(status as GoalStatus)) return null;
  if (approvalPolicy !== 'legacy_none' && !APPROVAL_POLICY.includes(approvalPolicy as ApprovalPolicy)) return null;

  const definition = value.capability.definition;
  const capabilityId = cleanString(definition.id);
  if (!capabilityId
    || !CAPABILITY_RISK_LEVELS.includes(definition.riskLevel as never)
    || !CAPABILITY_CONSENT_POLICIES.includes(definition.consentPolicy as never)
    || !CAPABILITY_HEALTH_STATES.includes(definition.health as never)
    || typeof value.capability.requiresConsent !== 'boolean') return null;

  const shouldRequireConsent = definition.consentPolicy !== 'none';
  if (value.capability.requiresConsent !== shouldRequireConsent) return null;

  const authorization = value.authorization === undefined ? undefined : parseReceipt(value.authorization);
  if (value.authorization !== undefined && !authorization) return null;

  return {
    goal: {
      id: goalId,
      revision,
      status: status as GoalStatus,
      approvalPolicy: approvalPolicy as ApprovalPolicy | 'legacy_none',
    },
    ...(authorization ? { authorization } : {}),
    capability: {
      definition: {
        id: capabilityId,
        version: cleanString(definition.version) ?? 'unknown',
        provider: cleanString(definition.provider) ?? 'unknown',
        riskLevel: definition.riskLevel as AuthorizedCapability['definition']['riskLevel'],
        consentPolicy: definition.consentPolicy as AuthorizedCapability['definition']['consentPolicy'],
        allowedDataScopes: [],
        credentialScopes: [],
        health: definition.health as AuthorizedCapability['definition']['health'],
      },
      requiresConsent: value.capability.requiresConsent,
    },
  };
}

function parseReceipt(value: unknown): GoalExecutionAuthorizationReceipt | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION) return null;
  const id = cleanString(value.id);
  const goalId = cleanString(value.goalId);
  const goalRevision = positiveInteger(value.goalRevision);
  const decidedBy = cleanString(value.decidedBy);
  if (!id || !goalId || goalRevision === null || !decidedBy) return null;
  if (value.decision !== 'approved' && value.decision !== 'rejected') return null;
  if (!GOAL_EXECUTION_AUTHORIZATION_SCOPES.includes(value.scope as GoalExecutionAuthorizationScope)) return null;
  if (!GOAL_EXECUTION_AUTHORIZATION_ACTORS.includes(value.actorType as GoalExecutionAuthorizationActor)) return null;
  if (typeof value.decidedAt !== 'string' || !Number.isFinite(Date.parse(value.decidedAt))) return null;
  return {
    schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
    id,
    goalId,
    goalRevision,
    decision: value.decision,
    scope: value.scope as GoalExecutionAuthorizationScope,
    actorType: value.actorType as GoalExecutionAuthorizationActor,
    decidedBy,
    decidedAt: value.decidedAt,
  };
}

function deny(reason: AutomaticReadOnlyDenialReason): AutomaticReadOnlyDecision {
  return { policyVersion: AUTOMATIC_READ_ONLY_POLICY_VERSION, allowed: false, reason };
}

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
