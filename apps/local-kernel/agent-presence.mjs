// Agent presence: what this Kernel has really observed from an external agent worker.
//
// Truth sources only:
// - in-memory contact records written by the Kernel itself when an authenticated, non-browser caller
//   polls /api/agent-missions/claim, posts results/failures, or runs the worker doctor ping;
// - persisted Mission records (agent, claimedAt, leaseExpiresAt, settled timestamps).
// Nothing here can be set by the dashboard: the ping refuses browser origins, so a "connected" state
// always means an agent process reached the Kernel with the token.

export const AGENT_ONLINE_WINDOW_MS = 120_000;
export const KNOWN_AGENTS = Object.freeze({ hermes: 'Hermes Agent' });
const CONTACT_KINDS = new Set(['poll', 'claim', 'result', 'failure', 'ping']);

export class AgentPresence {
  constructor({ now = () => new Date() } = {}) {
    this.now = now;
    this.startedAt = now().toISOString();
    this.records = new Map();
  }

  record(agent, kind) {
    if (!Object.hasOwn(KNOWN_AGENTS, agent) || !CONTACT_KINDS.has(kind)) return undefined;
    const at = this.now().toISOString();
    const current = this.records.get(agent) ?? {};
    const next = { ...current, lastSeenAt: at, lastSeenVia: kind };
    if (kind === 'claim') next.lastClaimAt = at;
    if (kind === 'result') next.lastResultAt = at;
    if (kind === 'failure') next.lastFailureAt = at;
    if (kind === 'ping') next.lastPingAt = at;
    this.records.set(agent, next);
    return at;
  }

  contact(agent) { return { ...(this.records.get(agent) ?? {}) }; }
}

const time = (value) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : undefined);

function hasLiveLease(mission, nowMs) {
  const expires = time(mission?.leaseExpiresAt);
  return mission?.status === 'running' && typeof mission?.leaseId === 'string' && expires !== undefined && expires > nowMs;
}

function lastActivity(mission) {
  const candidates = [mission.forgedAt, mission.completedAt, mission.failedAt, mission.verifyingAt, mission.claimedAt]
    .map((value) => ({ value, ms: time(value) })).filter((item) => item.ms !== undefined);
  candidates.sort((a, b) => b.ms - a.ms);
  return candidates[0]?.value;
}

function hasKernelSupport(mission) {
  return Array.isArray(mission?.verificationResults) && mission.verificationResults.some((item) => item?.supported === true
    && typeof item.evidenceId === 'string' && item.evidenceId.trim().length > 0);
}

/**
 * The last Mission's phase as the Kernel can prove it. "forged" only when the Mission completed with a
 * Kernel SUPPORT verdict on fetched Evidence; any other completion (no candidates, snippet-only, HTTP 200
 * read without SUPPORT, a bare forged stamp) is `completed_without_forge`, never finished work.
 */
function provenPhase(mission) {
  if (mission.status === 'completed') return mission.executionPhase === 'forged' && hasKernelSupport(mission) ? 'forged' : 'completed_without_forge';
  if (mission.executionPhase === 'forged') return mission.status;
  return mission.executionPhase ?? mission.status;
}

/**
 * One agent's connection as the Kernel can prove it. States:
 * - working: a Mission of this agent holds a live lease right now;
 * - online: the agent contacted this Kernel within the online window;
 * - seen: it contacted this Kernel since start, but not recently (the bundled worker runs in cycles);
 * - history: no contact since this Kernel started, but stored Missions show it worked here before;
 * - never: no contact and no stored Mission work.
 */
export function describeAgent(agent, { contact = {}, missions = [], now = new Date(), kernelStartedAt, windowMs = AGENT_ONLINE_WINDOW_MS } = {}) {
  const nowMs = now.getTime();
  const own = missions.filter((mission) => mission?.agent === agent);
  const active = own.find((mission) => hasLiveLease(mission, nowMs));
  const claimed = own.filter((mission) => time(mission.claimedAt) !== undefined)
    .sort((a, b) => (time(lastActivity(b)) ?? 0) - (time(lastActivity(a)) ?? 0));
  const last = claimed[0];
  const queued = own.filter((mission) => (mission.status === 'queued' || mission.status === 'waiting_for_agent') && !hasLiveLease(mission, nowMs)).length;
  const seenMs = time(contact.lastSeenAt);
  const state = active ? 'working'
    : seenMs !== undefined && nowMs - seenMs <= windowMs ? 'online'
      : seenMs !== undefined ? 'seen'
        : last ? 'history' : 'never';
  return {
    id: agent,
    label: KNOWN_AGENTS[agent] ?? agent,
    state,
    kernelStartedAt,
    onlineWindowMs: windowMs,
    lastSeenAt: contact.lastSeenAt,
    lastSeenVia: contact.lastSeenVia,
    lastPingAt: contact.lastPingAt,
    lastClaimAt: contact.lastClaimAt ?? last?.claimedAt,
    lastResultAt: contact.lastResultAt,
    lastFailureAt: contact.lastFailureAt,
    activeMission: active ? { id: active.id, goalTitle: active.goalTitle, attempt: active.attempt, claimedAt: active.claimedAt, leaseExpiresAt: active.leaseExpiresAt } : undefined,
    lastMission: last ? { id: last.id, goalTitle: last.goalTitle, phase: provenPhase(last), at: lastActivity(last) } : undefined,
    queuedMissions: queued,
  };
}

export function agentsSnapshot(presence, missions, now = new Date()) {
  return {
    ok: true,
    schemaVersion: 'efesto.agents.v1',
    kernelStartedAt: presence.startedAt,
    onlineWindowMs: AGENT_ONLINE_WINDOW_MS,
    agents: Object.keys(KNOWN_AGENTS).map((agent) => describeAgent(agent, { contact: presence.contact(agent), missions, now, kernelStartedAt: presence.startedAt })),
  };
}
