export const GOAL_CONTRACT_VERSION = 2 as const;

export const GOAL_STATUS = ['active', 'paused', 'completed', 'failed', 'cancelled'] as const;
export type GoalStatus = (typeof GOAL_STATUS)[number];

export const AUTONOMY_LEVEL = ['assisted', 'semi_autonomous', 'fully_autonomous'] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVEL)[number];

export const APPROVAL_POLICY = ['none', 'checkpoints', 'all_actions', 'custom'] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICY)[number];

export const NOTIFICATION_POLICY = ['none', 'on_completion', 'on_checkpoint', 'all'] as const;
export type NotificationPolicy = (typeof NOTIFICATION_POLICY)[number];

export const MEMORY_POLICY = ['none', 'learn_preferences', 'full_context'] as const;
export type MemoryPolicy = (typeof MEMORY_POLICY)[number];

export interface GoalConstraints {
  maxBudget?: number;
  maxDurationMs?: number;
  maxMissions?: number;
  maxConcurrentMissions?: number;
  allowedDomains?: string[];
  forbiddenDomains?: string[];
  allowedCapabilities?: string[];
  forbiddenCapabilities?: string[];
  allowedDataScopes?: string[];
  forbiddenDataScopes?: string[];
  forbiddenActions?: string[];
}

export interface GoalApprovalConfig {
  policy: ApprovalPolicy;
  requiredApprovers?: string[];
  checkpointIds?: string[];
  customPolicyRef?: string;
}

export interface GoalNotificationConfig {
  policy: NotificationPolicy;
  channels?: string[];
  onEvents?: string[];
}

export interface GoalMemoryConfig {
  policy: MemoryPolicy;
  scopeIds?: string[];
  retentionMs?: number;
}

export interface GoalTerminationCondition {
  type: 'deadline' | 'budget_exhausted' | 'max_missions' | 'success_criteria_met' | 'manual' | 'error_threshold';
  value?: string | number;
}

export interface GoalRevision {
  revision: number;
  changedAt: string;
  changedBy: string;
  diff: Record<string, { from: unknown; to: unknown }>;
}

export interface UniversalGoal {
  contractVersion: typeof GOAL_CONTRACT_VERSION;
  id: string;
  title: string;
  description?: string;
  desiredOutcome: string;
  successCriteria: string[];
  constraints: GoalConstraints;
  deadline?: string;
  budget?: number;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];
  allowedDataScopes: string[];
  forbiddenActions: string[];
  autonomyLevel: AutonomyLevel;
  approvalConfig: GoalApprovalConfig;
  notificationConfig: GoalNotificationConfig;
  memoryConfig: GoalMemoryConfig;
  terminationConditions: GoalTerminationCondition[];
  createdRevision: GoalRevision;
  currentRevision: GoalRevision;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export const GOAL_DEFAULTS: Partial<UniversalGoal> = {
  contractVersion: GOAL_CONTRACT_VERSION,
  status: 'active',
  autonomyLevel: 'assisted',
  approvalConfig: { policy: 'none' },
  notificationConfig: { policy: 'none' },
  memoryConfig: { policy: 'none' },
  allowedCapabilities: [],
  forbiddenCapabilities: [],
  allowedDataScopes: [],
  forbiddenActions: [],
  terminationConditions: [],
  constraints: {},
};

export function isLegacyGoal(goal: unknown): goal is LegacyGoal {
  if (!goal || typeof goal !== 'object') return false;
  const g = goal as Record<string, unknown>;
  return 'contractVersion' in g === false && 'categories' in g;
}

export interface LegacyGoal {
  id: string;
  title: string;
  categories: string[];
  keywords: string[];
  location?: string;
  priority: number;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
}

export function migrateLegacyToUniversal(legacy: LegacyGoal, changedBy = 'migration'): UniversalGoal {
  const now = new Date().toISOString();
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: legacy.id,
    title: legacy.title,
    description: undefined,
    desiredOutcome: legacy.title,
    successCriteria: ['Any relevant public finding returned and verified'],
    constraints: {
      allowedCapabilities: ['public_web_research'],
      forbiddenCapabilities: [],
    },
    deadline: undefined,
    budget: undefined,
    frequency: 'once',
    allowedCapabilities: ['public_web_research'],
    forbiddenCapabilities: [],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['purchase', 'submit', 'login', 'outreach', 'download', 'destructive'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'learn_preferences' },
    terminationConditions: [
      { type: 'max_missions', value: 1 },
      { type: 'success_criteria_met' },
    ],
    createdRevision: { revision: 1, changedAt: legacy.createdAt, changedBy: 'legacy', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy, diff: {} },
    status: legacy.status,
    createdAt: legacy.createdAt,
    updatedAt: now,
  };
}