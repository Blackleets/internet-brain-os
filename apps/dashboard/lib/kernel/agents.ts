// Agent connection as the Kernel proves it (GET /api/agents, efesto.agents.v1).
// The dashboard never decides an agent is connected: it only renders this Kernel-derived state.

export type AgentConnectionState = 'working' | 'online' | 'seen' | 'history' | 'never';
export type AgentContactKind = 'poll' | 'claim' | 'result' | 'failure' | 'ping';

export type AgentStatus = {
  id: string;
  label: string;
  state: AgentConnectionState;
  kernelStartedAt?: string;
  onlineWindowMs: number;
  lastSeenAt?: string;
  lastSeenVia?: AgentContactKind;
  lastPingAt?: string;
  lastClaimAt?: string;
  lastResultAt?: string;
  lastFailureAt?: string;
  activeMission?: { id: string; goalTitle?: string; attempt?: number; claimedAt?: string; leaseExpiresAt?: string };
  lastMission?: { id: string; goalTitle?: string; phase?: string; at?: string };
  queuedMissions: number;
};

export type AgentsSnapshot = { kernelStartedAt?: string; agents: AgentStatus[] };

const STATES = new Set<AgentConnectionState>(['working', 'online', 'seen', 'history', 'never']);
const KINDS = new Set<AgentContactKind>(['poll', 'claim', 'result', 'failure', 'ping']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const optionalTime = (value: unknown) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : undefined);
const optionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);

/** Fail-closed parser: an unknown state or schema means "no agent status", never a guessed one. */
export function parseAgents(value: unknown): AgentsSnapshot {
  if (!isRecord(value) || value.ok !== true || value.schemaVersion !== 'efesto.agents.v1' || !Array.isArray(value.agents)) {
    throw new Error('agents: unexpected contract');
  }
  const agents: AgentStatus[] = [];
  for (const item of value.agents) {
    if (!isRecord(item) || typeof item.id !== 'string' || !STATES.has(item.state as AgentConnectionState)) continue;
    const active = isRecord(item.activeMission) && typeof item.activeMission.id === 'string' ? item.activeMission : undefined;
    const last = isRecord(item.lastMission) && typeof item.lastMission.id === 'string' ? item.lastMission : undefined;
    agents.push({
      id: item.id,
      label: optionalText(item.label) ?? item.id,
      state: item.state as AgentConnectionState,
      kernelStartedAt: optionalTime(item.kernelStartedAt),
      onlineWindowMs: typeof item.onlineWindowMs === 'number' && item.onlineWindowMs > 0 ? item.onlineWindowMs : 120_000,
      lastSeenAt: optionalTime(item.lastSeenAt),
      lastSeenVia: KINDS.has(item.lastSeenVia as AgentContactKind) ? item.lastSeenVia as AgentContactKind : undefined,
      lastPingAt: optionalTime(item.lastPingAt),
      lastClaimAt: optionalTime(item.lastClaimAt),
      lastResultAt: optionalTime(item.lastResultAt),
      lastFailureAt: optionalTime(item.lastFailureAt),
      activeMission: active ? { id: String(active.id), goalTitle: optionalText(active.goalTitle), attempt: typeof active.attempt === 'number' ? active.attempt : undefined, claimedAt: optionalTime(active.claimedAt), leaseExpiresAt: optionalTime(active.leaseExpiresAt) } : undefined,
      lastMission: last ? { id: String(last.id), goalTitle: optionalText(last.goalTitle), phase: optionalText(last.phase), at: optionalTime(last.at) } : undefined,
      queuedMissions: typeof item.queuedMissions === 'number' && item.queuedMissions >= 0 ? item.queuedMissions : 0,
    });
  }
  return { kernelStartedAt: optionalTime(value.kernelStartedAt), agents };
}
