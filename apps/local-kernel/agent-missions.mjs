import { createHash } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';
import { createGoalExecutionAuthorizationReceipt } from './goal-execution-authorization.mjs';

const AGENTS = new Set(['hermes']);
const ACTIVE_STATUSES = new Set(['waiting_for_agent', 'queued']);
const MAX_ATTEMPTS = 3;
// "Buscar más": a finished Mission runs again and keeps a bounded record of its earlier attempts.
const MISSION_MODES = new Set(['restart', 'search_more']);
const MAX_PRIOR_ATTEMPTS = 5;
const MAX_PRIOR_ITEMS = 20;
const MAX_KNOWN_SOURCE_URLS = 40;

export class AgentMissionManager {
  constructor(store, options = {}) {
    this.store = store;
    this.isAgentReady = options.isAgentReady ?? (() => false);
    this.now = options.now ?? (() => new Date());
  }

  async create(goalId, input, context = {}) {
    if (!input || input.confirmed !== true) throw invalid('Mission requires explicit confirmation');
    const agent = clean(input.agent ?? 'hermes', 32).toLowerCase();
    if (!AGENTS.has(agent)) throw invalid('Agent is not supported');
    const cadence = clean(input.cadence ?? 'manual', 16).toLowerCase();
    if (!['manual', 'daily', 'weekly'].includes(cadence)) throw invalid('Mission cadence is invalid');
    const mode = input.mode === undefined ? 'restart' : clean(input.mode, 16).toLowerCase();
    if (!MISSION_MODES.has(mode)) throw invalid('Mission mode is invalid');
    // Searching more on a finished Mission is only ever a fresh, interactive user decision.
    if (mode === 'search_more' && !context?.confirmationActor) {
      throw new InboxError('MISSION_CONFIRMATION_REQUIRED', 'Searching more needs an interactive confirmation', 403);
    }

    return this.store.project(async (data) => {
      const goal = (data.goals ?? []).find((item) => item.id === goalId && item.status === 'active');
      if (!goal) throw new InboxError('GOAL_NOT_FOUND', 'Active Goal was not found', 404);
      const fingerprint = createHash('sha256').update(JSON.stringify({ goalId, agent, cadence })).digest('hex');
      const id = `mission:${fingerprint}`;
      const missions = Array.isArray(data.agentMissions) ? data.agentMissions : [];
      const existingIndex = missions.findIndex((item) => item.id === id);
      const ready = this.isAgentReady(agent) === true;
      const now = this.now();
      const confirmationActor = context?.confirmationActor;

      if (existingIndex >= 0) {
        const existing = missions[existingIndex];
        if (isActive(existing, now)) {
          if (existing.authorization || !confirmationActor) return { changed: false, data, result: existing };
          const authorized = { ...existing, authorization: createGoalExecutionAuthorizationReceipt(goal, now, confirmationActor) };
          const updated = [...missions];
          updated[existingIndex] = authorized;
          return { changed: true, data: { ...data, agentMissions: updated }, result: authorized };
        }
        if (mode === 'search_more' && !hasFinishedAttempt(existing)) {
          throw new InboxError('MISSION_NOT_FINISHED', 'Only a finished Mission can search for more', 409);
        }
        const restarted = mode === 'search_more'
          ? searchMoreMission(existing, goal, ready, now, confirmationActor)
          : restartMission(existing, goal, ready, now, confirmationActor);
        const updated = [...missions];
        updated[existingIndex] = restarted;
        return { changed: true, data: { ...data, agentMissions: updated }, result: restarted };
      }

      if (mode === 'search_more') throw new InboxError('AGENT_MISSION_NOT_FOUND', 'There is no finished Mission to search more for', 404);
      const mission = {
        id, goalId, goalTitle: goal.title, agent, cadence,
        status: ready ? 'queued' : 'waiting_for_agent',
        scope: { categories: goal.categories, keywords: goal.keywords, location: goal.location },
        ...authorizationFields(goal, now, confirmationActor),
        createdAt: now.toISOString(),
        limitation: ready ? 'Awaiting bounded external-agent execution' : `${agent} is not connected`,
      };
      return { changed: true, data: { ...data, agentMissions: [...missions, mission] }, result: mission };
    });
  }

  async list() {
    const now = this.now();
    return this.store.project(async (data) => {
      const missions = Array.isArray(data.agentMissions) ? data.agentMissions : [];
      let changed = false;
      const reconciled = missions.map((mission) => {
        const next = reconcileMission(mission, now, this.isAgentReady);
        if (next !== mission) changed = true;
        return next;
      });
      const sorted = [...reconciled].sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
      return { changed, data: changed ? { ...data, agentMissions: reconciled } : data, result: sorted };
    });
  }
}

function authorizationFields(goal, now, confirmationActor) {
  return confirmationActor ? { authorization: createGoalExecutionAuthorizationReceipt(goal, now, confirmationActor) } : {};
}

function isActive(mission, now) {
  if (ACTIVE_STATUSES.has(mission.status)) return true;
  return mission.status === 'running'
    && Number.isFinite(Date.parse(mission.leaseExpiresAt))
    && Date.parse(mission.leaseExpiresAt) > now.getTime();
}

function reconcileMission(mission, now, isAgentReady) {
  if (mission.status === 'waiting_for_agent' && isAgentReady(mission.agent) === true) {
    return {
      ...mission,
      status: 'queued',
      executionPhase: 'queued',
      limitation: 'Agent became ready; recovered and queued for authorized execution',
    };
  }
  return reconcileExpiredMission(mission, now);
}

function reconcileExpiredMission(mission, now) {
  if (mission.status !== 'running') return mission;
  const expiresAt = Date.parse(mission.leaseExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) return mission;
  const exhausted = Number(mission.attempt ?? 0) >= MAX_ATTEMPTS;
  const reconciledAt = now.toISOString();
  const next = {
    ...mission,
    status: exhausted ? 'failed' : 'queued',
    executionPhase: exhausted ? 'failed' : 'queued',
    lastFailure: {
      reason: exhausted ? 'Hermes did not complete before the final lease expired' : 'Hermes lease expired before completion',
      recordedAt: reconciledAt,
      attempt: Number(mission.attempt ?? 0),
    },
    limitation: exhausted ? 'Bounded external-agent attempts exhausted; explicit retry required' : 'Expired lease recovered and queued for retry',
  };
  delete next.leaseId;
  delete next.leaseExpiresAt;
  return next;
}

/** A Mission that already ran: its last attempt settled (or was left without a live lease). */
function hasFinishedAttempt(mission) {
  return Boolean(mission.completedAt || mission.verifyingAt || mission.failedAt
    || (Array.isArray(mission.verificationResults) && mission.verificationResults.length));
}

/**
 * "Buscar más": the same Mission starts a new attempt, and the attempt that just finished is kept
 * (bounded) in priorAttempts with its candidates, Kernel verification results and Evidence links.
 * Evidence and Finds are separate Kernel records and are never touched here; the new attempt adds
 * to them. knownSourceUrls lets the agent skip pages it already brought.
 */
function searchMoreMission(existing, goal, ready, now, confirmationActor) {
  const priorAttempts = [...(Array.isArray(existing.priorAttempts) ? existing.priorAttempts : []), archivedAttempt(existing)].slice(-MAX_PRIOR_ATTEMPTS);
  const knownSourceUrls = [];
  for (const attempt of [...priorAttempts].reverse()) {
    for (const url of [...attempt.verificationResults.map((item) => item.sourceUrl), ...attempt.searchCandidates.map((item) => item.url)]) {
      if (typeof url === 'string' && url && !knownSourceUrls.includes(url) && knownSourceUrls.length < MAX_KNOWN_SOURCE_URLS) knownSourceUrls.push(url);
    }
  }
  return {
    ...restartMission(existing, goal, ready, now, confirmationActor),
    searchMode: 'search_more',
    priorAttempts,
    ...(knownSourceUrls.length ? { knownSourceUrls } : {}),
  };
}

function archivedAttempt(mission) {
  const pick = (item, keys) => Object.fromEntries(keys.filter((key) => item?.[key] !== undefined).map((key) => [key, item[key]]));
  const candidates = Array.isArray(mission.searchCandidates) ? mission.searchCandidates : [];
  const results = Array.isArray(mission.verificationResults) ? mission.verificationResults : [];
  const settledAt = mission.forgedAt ?? mission.completedAt ?? mission.failedAt ?? mission.verifyingAt;
  return {
    startedAt: mission.createdAt,
    ...(settledAt ? { settledAt } : {}),
    status: mission.status,
    ...(mission.executionPhase ? { executionPhase: mission.executionPhase } : {}),
    ...(mission.resultSummary ? { resultSummary: pick(mission.resultSummary, ['received', 'evidenceCreated', 'opportunitiesPromoted']) } : {}),
    searchCandidates: candidates.slice(0, MAX_PRIOR_ITEMS).map((item) => pick(item, ['id', 'url', 'title', 'status'])),
    verificationResults: results.slice(0, MAX_PRIOR_ITEMS).map((item) => pick(item, ['candidateId', 'status', 'sourceUrl', 'evidenceId', 'supported', 'supportReason', 'reason'])),
    ...(mission.searchTelemetry ? { searchTelemetry: mission.searchTelemetry } : {}),
  };
}

function restartMission(existing, goal, ready, now, confirmationActor) {
  return {
    id: existing.id,
    goalId: existing.goalId,
    goalTitle: goal.title,
    agent: existing.agent,
    cadence: existing.cadence,
    status: ready ? 'queued' : 'waiting_for_agent',
    scope: { categories: goal.categories, keywords: goal.keywords, location: goal.location },
    ...authorizationFields(goal, now, confirmationActor),
    createdAt: now.toISOString(),
    attempt: 0,
    limitation: ready ? 'Awaiting bounded external-agent execution' : `${existing.agent} is not connected`,
  };
}

function clean(value, max) {
  if (typeof value !== 'string') throw invalid('Mission text must be a string');
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw invalid('Mission text is invalid');
  return result;
}
function invalid(message) { return new InboxError('INVALID_AGENT_MISSION', message, 400); }
