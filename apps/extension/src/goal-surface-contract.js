export const GOAL_SURFACE_SCHEMA_VERSION = 'efesto.goal-surface.v1';

const GOAL_STATUSES = ['active', 'paused', 'completed', 'failed', 'cancelled'];
const COMPATIBILITY = ['universal_v2', 'legacy_radar'];
const AUTONOMY_LEVELS = ['manual', 'assisted', 'semi_autonomous', 'autonomous'];
const APPROVAL_POLICIES = ['none', 'checkpoints', 'per_action', 'strict'];
const POLICY_SOURCES = ['goal_contract', 'legacy_compatibility'];
const MISSION_STATUSES = ['waiting_for_agent', 'queued', 'running', 'completed', 'failed'];
const EXECUTION_PHASES = ['queued', 'investigating', 'verifying', 'forged', 'failed'];
const WORK_STATES = ['idle', 'waiting_for_agent', 'queued', 'running', 'investigating', 'verifying', 'forged', 'completed', 'failed'];

export class GoalSurfaceContractError extends Error {
  constructor(path) {
    super(`Invalid Shared Goal Truth contract at ${path}`);
    this.name = 'GoalSurfaceContractError';
    this.code = 'INVALID_GOAL_SURFACE_CONTRACT';
    this.path = path;
  }
}

export function parseGoalSurfaces(value) {
  const body = record(value, 'goalSurfaces');
  exact(body.ok, true, 'goalSurfaces.ok');
  return array(body.surfaces, 'goalSurfaces.surfaces')
    .map((surface, index) => parseSurface(surface, `goalSurfaces.surfaces[${index}]`));
}

export function parseGoalSurface(value) {
  const body = record(value, 'goalSurface');
  exact(body.ok, true, 'goalSurface.ok');
  return parseSurface(body.surface, 'goalSurface.surface');
}

function parseSurface(value, path) {
  const surface = record(value, path);
  exact(surface.schemaVersion, GOAL_SURFACE_SCHEMA_VERSION, `${path}.schemaVersion`);
  exact(surface.sourceOfTruth, 'kernel', `${path}.sourceOfTruth`);
  const mission = surface.mission === undefined ? undefined : parseMission(surface.mission, `${path}.mission`);
  return {
    schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
    sourceOfTruth: 'kernel',
    observedAt: dateTime(surface.observedAt, `${path}.observedAt`),
    goal: parseGoal(surface.goal, `${path}.goal`),
    ...(mission === undefined ? {} : { mission }),
  };
}

function parseGoal(value, path) {
  const goal = record(value, path);
  const compatibility = enumeration(goal.compatibility, COMPATIBILITY, `${path}.compatibility`);
  const policy = record(goal.policySummary, `${path}.policySummary`);
  const policySource = enumeration(policy.source, POLICY_SOURCES, `${path}.policySummary.source`);
  if (compatibility === 'universal_v2' && policySource !== 'goal_contract') fail(`${path}.policySummary.source`);
  if (compatibility === 'legacy_radar' && policySource !== 'legacy_compatibility') fail(`${path}.policySummary.source`);
  return {
    id: text(goal.id, `${path}.id`, 240),
    title: text(goal.title, `${path}.title`, 500),
    status: enumeration(goal.status, GOAL_STATUSES, `${path}.status`),
    revision: positiveInteger(goal.revision, `${path}.revision`),
    createdAt: dateTime(goal.createdAt, `${path}.createdAt`),
    updatedAt: dateTime(goal.updatedAt, `${path}.updatedAt`),
    compatibility,
    policySummary: {
      autonomyLevel: enumeration(policy.autonomyLevel, AUTONOMY_LEVELS, `${path}.policySummary.autonomyLevel`),
      approvalPolicy: enumeration(policy.approvalPolicy, APPROVAL_POLICIES, `${path}.policySummary.approvalPolicy`),
      source: policySource,
    },
  };
}

function parseMission(value, path) {
  const mission = record(value, path);
  const executionPhase = mission.executionPhase === undefined
    ? undefined
    : enumeration(mission.executionPhase, EXECUTION_PHASES, `${path}.executionPhase`);
  const attempt = mission.attempt === undefined ? undefined : nonNegativeInteger(mission.attempt, `${path}.attempt`);
  const limitation = mission.limitation === undefined ? undefined : text(mission.limitation, `${path}.limitation`, 500);
  const findCount = mission.findCount === undefined ? undefined : nonNegativeInteger(mission.findCount, `${path}.findCount`);
  return {
    id: text(mission.id, `${path}.id`, 240),
    status: enumeration(mission.status, MISSION_STATUSES, `${path}.status`),
    ...(executionPhase === undefined ? {} : { executionPhase }),
    workState: enumeration(mission.workState, WORK_STATES, `${path}.workState`),
    createdAt: dateTime(mission.createdAt, `${path}.createdAt`),
    updatedAt: dateTime(mission.updatedAt, `${path}.updatedAt`),
    ...(attempt === undefined ? {} : { attempt }),
    ...(limitation === undefined ? {} : { limitation }),
    ...(findCount === undefined ? {} : { findCount }),
  };
}

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path);
  return value;
}

function array(value, path) {
  if (!Array.isArray(value)) fail(path);
  return value;
}

function text(value, path, maxLength) {
  if (typeof value !== 'string') fail(path);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) fail(path);
  return normalized;
}

function dateTime(value, path) {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) fail(path);
  return value;
}

function positiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 1) fail(path);
  return value;
}

function nonNegativeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) fail(path);
  return value;
}

function enumeration(value, allowed, path) {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(path);
  return value;
}

function exact(value, expected, path) {
  if (value !== expected) fail(path);
  return expected;
}

function fail(path) {
  throw new GoalSurfaceContractError(path);
}
