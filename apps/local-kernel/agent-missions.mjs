import { createHash } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';

const AGENTS = new Set(['hermes']);
const ACTIVE_STATUSES = new Set(['waiting_for_agent', 'queued']);

export class AgentMissionManager {
  constructor(store, options = {}) {
    this.store = store;
    this.isAgentReady = options.isAgentReady ?? (() => false);
    this.now = options.now ?? (() => new Date());
  }

  async create(goalId, input) {
    if (!input || input.confirmed !== true) throw invalid('Mission requires explicit confirmation');
    const agent = clean(input.agent ?? 'hermes', 32).toLowerCase();
    if (!AGENTS.has(agent)) throw invalid('Agent is not supported');
    const cadence = clean(input.cadence ?? 'manual', 16).toLowerCase();
    if (!['manual', 'daily', 'weekly'].includes(cadence)) throw invalid('Mission cadence is invalid');

    return this.store.project(async (data) => {
      const goal = (data.goals ?? []).find((item) => item.id === goalId && item.status === 'active');
      if (!goal) throw new InboxError('GOAL_NOT_FOUND', 'Active Goal was not found', 404);
      const fingerprint = createHash('sha256').update(JSON.stringify({ goalId, agent, cadence })).digest('hex');
      const id = `mission:${fingerprint}`;
      const missions = Array.isArray(data.agentMissions) ? data.agentMissions : [];
      const existingIndex = missions.findIndex((item) => item.id === id);
      const ready = this.isAgentReady(agent) === true;
      const now = this.now();

      if (existingIndex >= 0) {
        const existing = missions[existingIndex];
        if (isActive(existing, now)) return { changed: false, data, result: existing };
        const restarted = restartMission(existing, goal, ready, now);
        const updated = [...missions];
        updated[existingIndex] = restarted;
        return { changed: true, data: { ...data, agentMissions: updated }, result: restarted };
      }

      const mission = {
        id, goalId, goalTitle: goal.title, agent, cadence,
        status: ready ? 'queued' : 'waiting_for_agent',
        scope: { categories: goal.categories, keywords: goal.keywords, location: goal.location },
        createdAt: now.toISOString(),
        limitation: ready ? 'Awaiting bounded external-agent execution' : `${agent} is not connected`,
      };
      return { changed: true, data: { ...data, agentMissions: [...missions, mission] }, result: mission };
    });
  }

  async list() {
    const data = await this.store.read();
    return (data.agentMissions ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

function isActive(mission, now) {
  if (ACTIVE_STATUSES.has(mission.status)) return true;
  return mission.status === 'running'
    && Number.isFinite(Date.parse(mission.leaseExpiresAt))
    && Date.parse(mission.leaseExpiresAt) > now.getTime();
}

function restartMission(existing, goal, ready, now) {
  const mission = {
    id: existing.id,
    goalId: existing.goalId,
    goalTitle: goal.title,
    agent: existing.agent,
    cadence: existing.cadence,
    status: ready ? 'queued' : 'waiting_for_agent',
    scope: { categories: goal.categories, keywords: goal.keywords, location: goal.location },
    createdAt: now.toISOString(),
    attempt: 0,
    limitation: ready ? 'Awaiting bounded external-agent execution' : `${existing.agent} is not connected`,
  };
  return mission;
}

function clean(value, max) {
  if (typeof value !== 'string') throw invalid('Mission text must be a string');
  const result = value.trim();
  if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw invalid('Mission text is invalid');
  return result;
}
function invalid(message) { return new InboxError('INVALID_AGENT_MISSION', message, 400); }
