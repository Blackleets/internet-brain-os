import { KernelClient } from './client';

export const GOAL_SURFACE_SCHEMA_VERSION = 'efesto.goal-surface.v1' as const;

export type GoalSurfaceGoalStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type GoalSurfaceCompatibility = 'universal_v2' | 'legacy_radar';
export type GoalSurfaceAutonomyLevel = 'manual' | 'assisted' | 'semi_autonomous' | 'autonomous';
export type GoalSurfaceApprovalPolicy = 'none' | 'checkpoints' | 'per_action' | 'strict';
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

export type GoalSurface = {
  schemaVersion: typeof GOAL_SURFACE_SCHEMA_VERSION;
  sourceOfTruth: 'kernel';
  observedAt: string;
  goal: {
    id: string;
    title: string;
    status: GoalSurfaceGoalStatus;
    revision: number;
    createdAt: string;
    updatedAt: string;
    compatibility: GoalSurfaceCompatibility;
    policySummary: {
      autonomyLevel: GoalSurfaceAutonomyLevel;
      approvalPolicy: GoalSurfaceApprovalPolicy;
      source: 'goal_contract' | 'legacy_compatibility';
    };
  };
  mission?: {
    id: string;
    status: GoalSurfaceMissionStatus;
    executionPhase?: GoalSurfaceExecutionPhase;
    workState: GoalSurfaceWorkState;
    createdAt: string;
    updatedAt: string;
    attempt?: number;
    limitation?: string;
    blockedReason?: string;
    findCount?: number;
  };
};

export class GoalSurfaceContractError extends Error {
  readonly name = 'GoalSurfaceContractError';
  constructor(readonly path: string) {
    super(`Invalid Shared Goal Truth contract at ${path}`);
  }
}

export async function loadGoalSurfaces(client: KernelClient, signal?: AbortSignal): Promise<GoalSurface[]> {
  return client.get('/api/goal-surfaces', parseGoalSurfaces, signal);
}

export async function loadGoalSurface(
  client: KernelClient,
  goalId: string,
  signal?: AbortSignal,
): Promise<GoalSurface> {
  const normalizedGoalId = requireText(goalId, 'goalId', 240);
  return client.get(`/api/goal-surfaces/${encodeURIComponent(normalizedGoalId)}`, parseGoalSurface, signal);
}

export function parseGoalSurfaces(value: unknown): GoalSurface[] {
  const body = record(value, 'goalSurfaces');
  exactTrue(body.ok, 'goalSurfaces.ok');
  const surfaces = array(body.surfaces, 'goalSurfaces.surfaces');
  return surfaces.map((surface, index) => parseSurface(surface, `goalSurfaces.surfaces[${index}]`));
}

export function parseGoalSurface(value: unknown): GoalSurface {
  const body = record(value, 'goalSurface');
  exactTrue(body.ok, 'goalSurface.ok');
  return parseSurface(body.surface, 'goalSurface.surface');
}

function parseSurface(value: unknown, path: string): GoalSurface {
  const surface = record(value, path);
  exact(surface.schemaVersion, GOAL_SURFACE_SCHEMA_VERSION, `${path}.schemaVersion`);
  exact(surface.sourceOfTruth, 'kernel', `${path}.sourceOfTruth`);
  const observedAt = dateTime(surface.observedAt, `${path}.observedAt`);
  const goal = parseGoal(surface.goal, `${path}.goal`);
  const mission = surface.mission === undefined ? undefined : parseMission(surface.mission, `${path}.mission`);
  return {
    schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
    sourceOfTruth: 'kernel',
    observedAt,
    goal,
    ...(mission ? { mission } : {}),
  };
}

function parseGoal(value: unknown, path: string): GoalSurface['goal'] {
  const goal = record(value, path);
  const compatibility = enumeration(goal.compatibility, ['universal_v2', 'legacy_radar'] as const, `${path}.compatibility`);
  const policy = record(goal.policySummary, `${path}.policySummary`);
  const policySource = enumeration(policy.source, ['goal_contract', 'legacy_compatibility'] as const, `${path}.policySummary.source`);
  if (compatibility === 'universal_v2' && policySource !== 'goal_contract') fail(`${path}.policySummary.source`);
  if (compatibility === 'legacy_radar' && policySource !== 'legacy_compatibility') fail(`${path}.policySummary.source`);

  return {
    id: requireText(goal.id, `${path}.id`, 240),
    title: requireText(goal.title, `${path}.title`, 500),
    status: enumeration(goal.status, ['active', 'paused', 'completed', 'failed', 'cancelled'] as const, `${path}.status`),
    revision: positiveInteger(goal.revision, `${path}.revision`),
    createdAt: dateTime(goal.createdAt, `${path}.createdAt`),
    updatedAt: dateTime(goal.updatedAt, `${path}.updatedAt`),
    compatibility,
    policySummary: {
      autonomyLevel: enumeration(
        policy.autonomyLevel,
        ['manual', 'assisted', 'semi_autonomous', 'autonomous'] as const,
        `${path}.policySummary.autonomyLevel`,
      ),
      approvalPolicy: enumeration(
        policy.approvalPolicy,
        ['none', 'checkpoints', 'per_action', 'strict'] as const,
        `${path}.policySummary.approvalPolicy`,
      ),
      source: policySource,
    },
  };
}

function parseMission(value: unknown, path: string): NonNullable<GoalSurface['mission']> {
  const mission = record(value, path);
  const executionPhase = mission.executionPhase === undefined
    ? undefined
    : enumeration(
      mission.executionPhase,
      ['queued', 'investigating', 'verifying', 'forged', 'failed'] as const,
      `${path}.executionPhase`,
    );
  const attempt = mission.attempt === undefined ? undefined : nonNegativeInteger(mission.attempt, `${path}.attempt`);
  const limitation = mission.limitation === undefined ? undefined : requireText(mission.limitation, `${path}.limitation`, 500);
  const blockedReason = mission.blockedReason === undefined ? undefined : requireText(mission.blockedReason, `${path}.blockedReason`, 240);
  const findCount = mission.findCount === undefined ? undefined : nonNegativeInteger(mission.findCount, `${path}.findCount`);
  return {
    id: requireText(mission.id, `${path}.id`, 240),
    status: enumeration(
      mission.status,
      ['waiting_for_agent', 'queued', 'running', 'completed', 'failed'] as const,
      `${path}.status`,
    ),
    ...(executionPhase ? { executionPhase } : {}),
    workState: enumeration(
      mission.workState,
      ['idle', 'waiting_for_agent', 'queued', 'running', 'investigating', 'verifying', 'forged', 'completed', 'failed'] as const,
      `${path}.workState`,
    ),
    createdAt: dateTime(mission.createdAt, `${path}.createdAt`),
    updatedAt: dateTime(mission.updatedAt, `${path}.updatedAt`),
    ...(attempt !== undefined ? { attempt } : {}),
    ...(limitation !== undefined ? { limitation } : {}),
    ...(blockedReason !== undefined ? { blockedReason } : {}),
    ...(findCount !== undefined ? { findCount } : {}),
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path);
  return value as unknown[];
}

function requireText(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string') fail(path);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) fail(path);
  return normalized;
}

function dateTime(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) fail(path);
  return value;
}

function positiveInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) fail(path);
  return Number(value);
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) fail(path);
  return Number(value);
}

function exactTrue(value: unknown, path: string): void {
  if (value !== true) fail(path);
}

function exact<T extends string>(value: unknown, expected: T, path: string): T {
  if (value !== expected) fail(path);
  return expected;
}

function enumeration<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) fail(path);
  return value as T;
}

function fail(path: string): never {
  throw new GoalSurfaceContractError(path);
}
