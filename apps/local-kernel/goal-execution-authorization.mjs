import { createHash } from 'node:crypto';

export const GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION = 'efesto.goal-execution-authorization.v1';
const READ_ONLY_SCOPE = 'read_only_continuation';
const TRUSTED_ACTOR_TYPES = new Set(['interactive_user', 'founder']);

export function createGoalExecutionAuthorizationReceipt(goal, decidedAt, actor) {
  const goalId = clean(goal?.id, 'Goal id');
  const goalRevision = currentGoalRevision(goal);
  const timestamp = normalizeDate(decidedAt);
  const actorType = clean(actor?.actorType, 'Goal authorization actor type');
  const decidedBy = clean(actor?.decidedBy, 'Goal authorization actor id');
  if (!TRUSTED_ACTOR_TYPES.has(actorType)) throw new Error('Goal authorization actor is not trusted');
  const canonical = {
    schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
    goalId,
    goalRevision,
    decision: 'approved',
    scope: READ_ONLY_SCOPE,
    actorType,
    decidedBy,
    decidedAt: timestamp,
  };
  const fingerprint = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  return { ...canonical, id: `goal-auth:${fingerprint}` };
}

export function currentGoalRevision(goal) {
  if (goal?.contractVersion === 2) {
    const revision = Number(goal?.currentRevision?.revision);
    if (!Number.isInteger(revision) || revision < 1) throw new Error('Universal Goal revision is invalid');
    return revision;
  }
  return 1;
}

function normalizeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Goal authorization time is invalid');
  return date.toISOString();
}

function clean(value, field) {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error(`${field} is invalid`);
  return normalized;
}
