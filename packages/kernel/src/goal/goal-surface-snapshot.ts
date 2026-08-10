import {
  APPROVAL_POLICY,
  AUTONOMY_LEVEL,
  GOAL_CONTRACT_VERSION,
  GOAL_STATUS,
  type ApprovalPolicy,
  type AutonomyLevel,
  type GoalStatus,
  type LegacyGoal,
  type UniversalGoal,
} from './goal-contract';

export const GOAL_SURFACE_SCHEMA_VERSION = 'efesto.goal-surface.v1' as const;

export type GoalSurfaceCompatibility = 'universal_v2' | 'legacy_radar';
export type GoalSurfaceMissionStatus = 'waiting_for_agent' | 'queued' | 'running' | 'completed' | 'failed';
export type GoalSurfaceExecutionPhase = 'queued' | 'investigating' | 'verifying' | 'forged' | 'failed';
export type GoalSurfaceWorkState =
  | 'idle'
  | 'waiting_for_agent'
  | 'queued'
  | 'running'
  | 'investigating'
  | 'verifying'
  | 'forged'
  | 'completed'
  | 'failed';

export interface GoalSurfaceMissionRecord {
  readonly id: string;
  readonly goalId: string;
  readonly status: GoalSurfaceMissionStatus;
  readonly executionPhase?: GoalSurfaceExecutionPhase;
  readonly createdAt: string;
  readonly claimedAt?: string;
  readonly investigatingAt?: string;
  readonly verifyingAt?: string;
  readonly forgedAt?: string;
  readonly completedAt?: string;
  readonly attempt?: number;
  readonly limitation?: string;
  readonly automaticBlock?: {
    readonly reason: string;
  };
  readonly lastFailure?: {
    readonly reason?: string;
    readonly recordedAt?: string;
    readonly attempt?: number;
  };
  readonly resultSummary?: {
    readonly opportunitiesPromoted?: number;
  };
}

export interface GoalSurfaceMissionSnapshot {
  readonly id: string;
  readonly status: GoalSurfaceMissionStatus;
  readonly executionPhase?: GoalSurfaceExecutionPhase;
  readonly workState: GoalSurfaceWorkState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly attempt?: number;
  readonly limitation?: string;
  readonly blockedReason?: string;
  readonly findCount?: number;
}

export interface GoalSurfaceSnapshot {
  readonly schemaVersion: typeof GOAL_SURFACE_SCHEMA_VERSION;
  readonly sourceOfTruth: 'kernel';
  readonly observedAt: string;
  readonly goal: {
    readonly id: string;
    readonly title: string;
    readonly status: GoalStatus;
    readonly revision: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly compatibility: GoalSurfaceCompatibility;
    readonly policySummary: {
      readonly autonomyLevel: AutonomyLevel;
      readonly approvalPolicy: ApprovalPolicy;
      readonly source: 'goal_contract' | 'legacy_compatibility';
    };
  };
  readonly mission?: GoalSurfaceMissionSnapshot;
}

export class GoalSurfaceSnapshotInputError extends Error {
  readonly name = 'GoalSurfaceSnapshotInputError';
  constructor(message: string) {
    super(message);
  }
}

export interface BuildGoalSurfaceSnapshotInput {
  readonly goal: UniversalGoal | LegacyGoal;
  readonly missions?: readonly GoalSurfaceMissionRecord[];
  readonly observedAt: string;
}

export interface BuildGoalSurfaceSnapshotsInput {
  readonly goals: readonly (UniversalGoal | LegacyGoal)[];
  readonly missions?: readonly GoalSurfaceMissionRecord[];
  readonly observedAt: string;
}

/**
 * Provider-neutral read projection for product surfaces.
 * It never mutates Goal/Mission state and never grants capability, approval or memory authority.
 */
export function buildGoalSurfaceSnapshot(input: BuildGoalSurfaceSnapshotInput): GoalSurfaceSnapshot {
  if (!isRecord(input)) throw new GoalSurfaceSnapshotInputError('input must be an object.');
  const observedAt = requireDateTime(input.observedAt, 'observedAt');
  const goal = normalizeGoal(input.goal);
  const missions = normalizeMissionList(input.missions ?? [])
    .filter((mission) => mission.goalId === goal.id)
    .sort(compareMissionForCurrentSelection);
  const mission = missions[0];

  return {
    schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
    sourceOfTruth: 'kernel',
    observedAt,
    goal: {
      id: goal.id,
      title: goal.title,
      status: goal.status,
      revision: goal.revision,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
      compatibility: goal.compatibility,
      policySummary: {
        autonomyLevel: goal.autonomyLevel,
        approvalPolicy: goal.approvalPolicy,
        source: goal.compatibility === 'universal_v2' ? 'goal_contract' : 'legacy_compatibility',
      },
    },
    ...(mission ? { mission: projectMission(mission) } : {}),
  };
}

export function buildGoalSurfaceSnapshots(input: BuildGoalSurfaceSnapshotsInput): readonly GoalSurfaceSnapshot[] {
  if (!isRecord(input)) throw new GoalSurfaceSnapshotInputError('input must be an object.');
  if (!Array.isArray(input.goals)) throw new GoalSurfaceSnapshotInputError('goals must be an array.');
  if (input.missions !== undefined && !Array.isArray(input.missions)) {
    throw new GoalSurfaceSnapshotInputError('missions must be an array when supplied.');
  }
  const observedAt = requireDateTime(input.observedAt, 'observedAt');
  const missions = normalizeMissionList(input.missions ?? []);
  return input.goals
    .map((goal) => buildGoalSurfaceSnapshot({ goal, missions, observedAt }))
    .sort(compareSurface);
}

type NormalizedGoal = {
  readonly id: string;
  readonly title: string;
  readonly status: GoalStatus;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly compatibility: GoalSurfaceCompatibility;
  readonly autonomyLevel: AutonomyLevel;
  readonly approvalPolicy: ApprovalPolicy;
};

type NormalizedMission = {
  readonly id: string;
  readonly goalId: string;
  readonly status: GoalSurfaceMissionStatus;
  readonly executionPhase?: GoalSurfaceExecutionPhase;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly attempt?: number;
  readonly limitation?: string;
  readonly blockedReason?: string;
  readonly findCount?: number;
};

function normalizeGoal(value: UniversalGoal | LegacyGoal): NormalizedGoal {
  if (!isRecord(value)) throw new GoalSurfaceSnapshotInputError('goal must be an object.');
  const id = requireText(value.id, 'goal.id', 240);
  const title = requireText(value.title, 'goal.title', 500);
  const createdAt = requireDateTime(value.createdAt, 'goal.createdAt');

  if (value.contractVersion === GOAL_CONTRACT_VERSION) {
    const status = requireEnum(value.status, GOAL_STATUS, 'goal.status');
    const autonomyLevel = requireEnum(value.autonomyLevel, AUTONOMY_LEVEL, 'goal.autonomyLevel');
    if (!isRecord(value.approvalConfig)) throw new GoalSurfaceSnapshotInputError('goal.approvalConfig must be an object.');
    const approvalPolicy = requireEnum(value.approvalConfig.policy, APPROVAL_POLICY, 'goal.approvalConfig.policy');
    if (!isRecord(value.currentRevision)
      || !Number.isSafeInteger(value.currentRevision.revision)
      || Number(value.currentRevision.revision) < 1) {
      throw new GoalSurfaceSnapshotInputError('goal.currentRevision.revision must be a positive safe integer.');
    }
    return {
      id,
      title,
      status,
      revision: Number(value.currentRevision.revision),
      createdAt,
      updatedAt: requireDateTime(value.updatedAt, 'goal.updatedAt'),
      compatibility: 'universal_v2',
      autonomyLevel,
      approvalPolicy,
    };
  }

  if ('contractVersion' in value) {
    throw new GoalSurfaceSnapshotInputError('goal.contractVersion is unsupported.');
  }
  const legacyStatus = requireEnum(value.status, ['active', 'paused', 'completed'] as const, 'goal.status');
  return {
    id,
    title,
    status: legacyStatus,
    revision: 1,
    createdAt,
    updatedAt: createdAt,
    compatibility: 'legacy_radar',
    autonomyLevel: 'assisted',
    approvalPolicy: 'none',
  };
}

function normalizeMissionList(value: readonly GoalSurfaceMissionRecord[]): NormalizedMission[] {
  if (!Array.isArray(value)) throw new GoalSurfaceSnapshotInputError('missions must be an array.');
  return value.map((mission, index) => normalizeMission(mission, index));
}

function normalizeMission(value: GoalSurfaceMissionRecord, index: number): NormalizedMission {
  if (!isRecord(value)) throw new GoalSurfaceSnapshotInputError(`missions[${index}] must be an object.`);
  const id = requireText(value.id, `missions[${index}].id`, 240);
  const goalId = requireText(value.goalId, `missions[${index}].goalId`, 240);
  const status = requireEnum(
    value.status,
    ['waiting_for_agent', 'queued', 'running', 'completed', 'failed'] as const,
    `missions[${index}].status`,
  );
  const executionPhase = value.executionPhase === undefined
    ? undefined
    : requireEnum(
      value.executionPhase,
      ['queued', 'investigating', 'verifying', 'forged', 'failed'] as const,
      `missions[${index}].executionPhase`,
    );
  const createdAt = requireDateTime(value.createdAt, `missions[${index}].createdAt`);
  const timestamps = [
    value.claimedAt,
    value.investigatingAt,
    value.verifyingAt,
    value.forgedAt,
    value.completedAt,
    isRecord(value.lastFailure) ? value.lastFailure.recordedAt : undefined,
  ].filter((entry): entry is string => entry !== undefined)
    .map((entry) => requireDateTime(entry, `missions[${index}].activityAt`));
  const updatedAt = [createdAt, ...timestamps].sort().at(-1) ?? createdAt;

  if (value.attempt !== undefined && (!Number.isSafeInteger(value.attempt) || Number(value.attempt) < 0)) {
    throw new GoalSurfaceSnapshotInputError(`missions[${index}].attempt must be a non-negative safe integer.`);
  }
  const limitation = value.limitation === undefined
    ? undefined
    : requireText(value.limitation, `missions[${index}].limitation`, 500);
  const blockedReason = value.automaticBlock === undefined
    ? undefined
    : normalizeAutomaticBlockReason(value.automaticBlock, index);
  const promoted = isRecord(value.resultSummary) ? value.resultSummary.opportunitiesPromoted : undefined;
  if (promoted !== undefined && (!Number.isSafeInteger(promoted) || Number(promoted) < 0)) {
    throw new GoalSurfaceSnapshotInputError(`missions[${index}].resultSummary.opportunitiesPromoted must be a non-negative safe integer.`);
  }

  return {
    id,
    goalId,
    status,
    ...(executionPhase ? { executionPhase } : {}),
    createdAt,
    updatedAt,
    ...(value.attempt !== undefined ? { attempt: Number(value.attempt) } : {}),
    ...(limitation ? { limitation } : {}),
    ...(blockedReason ? { blockedReason } : {}),
    ...(promoted !== undefined ? { findCount: Number(promoted) } : {}),
  };
}

function normalizeAutomaticBlockReason(value: unknown, index: number): string {
  if (!isRecord(value)) {
    throw new GoalSurfaceSnapshotInputError(`missions[${index}].automaticBlock must be an object.`);
  }
  return requireText(value.reason, `missions[${index}].automaticBlock.reason`, 240);
}

function projectMission(mission: NormalizedMission): GoalSurfaceMissionSnapshot {
  return {
    id: mission.id,
    status: mission.status,
    ...(mission.executionPhase ? { executionPhase: mission.executionPhase } : {}),
    workState: deriveWorkState(mission),
    createdAt: mission.createdAt,
    updatedAt: mission.updatedAt,
    ...(mission.attempt !== undefined ? { attempt: mission.attempt } : {}),
    ...(mission.limitation ? { limitation: mission.limitation } : {}),
    ...(mission.blockedReason ? { blockedReason: mission.blockedReason } : {}),
    ...(mission.findCount !== undefined ? { findCount: mission.findCount } : {}),
  };
}

function deriveWorkState(mission: NormalizedMission): GoalSurfaceWorkState {
  if (mission.blockedReason) return 'failed';
  if (mission.executionPhase === 'investigating') return 'investigating';
  if (mission.executionPhase === 'verifying') return 'verifying';
  if (mission.executionPhase === 'forged') return 'forged';
  if (mission.executionPhase === 'failed') return 'failed';
  if (mission.executionPhase === 'queued') return 'queued';
  if (mission.status === 'waiting_for_agent') return 'waiting_for_agent';
  if (mission.status === 'queued') return 'queued';
  if (mission.status === 'running') return 'running';
  if (mission.status === 'completed') return 'completed';
  return 'failed';
}

function compareMissionForCurrentSelection(left: NormalizedMission, right: NormalizedMission): number {
  return missionPriority(left.status) - missionPriority(right.status)
    || right.updatedAt.localeCompare(left.updatedAt)
    || left.id.localeCompare(right.id);
}

function missionPriority(status: GoalSurfaceMissionStatus): number {
  if (status === 'running') return 0;
  if (status === 'queued') return 1;
  if (status === 'waiting_for_agent') return 2;
  if (status === 'completed') return 3;
  return 4;
}

function compareSurface(left: GoalSurfaceSnapshot, right: GoalSurfaceSnapshot): number {
  return goalPriority(left.goal.status) - goalPriority(right.goal.status)
    || right.goal.updatedAt.localeCompare(left.goal.updatedAt)
    || left.goal.id.localeCompare(right.goal.id);
}

function goalPriority(status: GoalStatus): number {
  if (status === 'active') return 0;
  if (status === 'paused') return 1;
  if (status === 'completed') return 2;
  if (status === 'failed') return 3;
  return 4;
}

function requireText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new GoalSurfaceSnapshotInputError(`${field} must be a string.`);
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new GoalSurfaceSnapshotInputError(`${field} is invalid.`);
  }
  return normalized;
}

function requireDateTime(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new GoalSurfaceSnapshotInputError(`${field} must be a string date-time.`);
  const normalized = value.trim();
  if (!normalized || Number.isNaN(Date.parse(normalized))) {
    throw new GoalSurfaceSnapshotInputError(`${field} must be a valid date-time.`);
  }
  return normalized;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new GoalSurfaceSnapshotInputError(`${field} is unsupported.`);
  }
  return value as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
