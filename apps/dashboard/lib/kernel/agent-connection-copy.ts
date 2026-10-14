import { getLocale, t } from '../i18n';
import type { AgentContactKind, AgentStatus } from './agents';

export type AgentTone = 'live' | 'ok' | 'idle' | 'off';
export type AgentCopy = { tone: AgentTone; title: string; detail: string; short: string };

const VIA: Record<AgentContactKind, string> = {
  get ping() { return t('ag.autoCheck'); },
  get poll() { return t('ag.polled'); },
  get claim() { return t('ag.claimed'); },
  get result() { return t('ag.delivered'); },
  get failure() { return t('ag.reportedFail'); },
};

export function formatAgo(fromIso: string | undefined, nowMs: number): string {
  const at = fromIso ? Date.parse(fromIso) : Number.NaN;
  if (!Number.isFinite(at)) return t('ag.noDate');
  const seconds = Math.max(0, Math.round((nowMs - at) / 1000));
  if (seconds < 60) return t('ag.agoS', { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('ag.agoM', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('ag.agoH', { n: hours });
  return t('ag.agoD', { n: Math.round(hours / 24) });
}

export function formatClock(iso: string | undefined): string {
  const at = iso ? new Date(iso) : undefined;
  if (!at || Number.isNaN(at.getTime())) return '—';
  return at.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
}

// "completed" without a Kernel forge is not finished work: same wording as the sidebar Goal status.
// verified_without_support (pages read, none passed SUPPORT) is not "fallida": sidebar "sin SUPPORT".
const PHASES = (): Record<string, string> => ({ forged: t('ag.phForged'), verifying: t('ag.phVerifying'), investigating: t('ag.phInvestigating'), failed: t('ag.phFailed'), queued: t('s.queued'), completed: t('s.endedNoEvidenceLower'), completed_without_forge: t('s.endedNoEvidenceLower'), verified_without_support: t('s.noSupportLower'), running: t('f.inProgress') });

/**
 * Human copy for one agent, derived only from the Kernel's own state. `available === false` means
 * the Kernel does not publish /api/agents (older build): we say that instead of guessing.
 */
export function agentConnectionCopy(agent: AgentStatus | undefined, available: boolean, nowMs: number, missions?: readonly { id: string; status?: string }[]): AgentCopy {
  // /api/agents and /api/agent-missions are read together; if the Mission the agent was "working" on
  // is already settled in the Missions list, the agent is no longer working on it.
  const activeId = agent?.state === 'working' ? agent.activeMission?.id : undefined;
  if (agent && activeId && missions?.some((m) => m.id === activeId && (m.status === 'failed' || m.status === 'completed'))) {
    agent = { ...agent, state: 'online', activeMission: undefined, lastSeenAt: agent.lastSeenAt ?? new Date(nowMs).toISOString() };
  }
  if (!available || !agent) {
    return { tone: 'off', short: t('ag.noState'), title: t('ag.stateUnavailable'), detail: t('ag.stateUnavailableCopy') };
  }
  const name = agent.label.replace(/ Agent$/, '');
  const queued = agent.queuedMissions > 0 ? ` ${t(agent.queuedMissions === 1 ? 'ag.queuedOne' : 'ag.queuedN', { n: agent.queuedMissions })}` : '';
  switch (agent.state) {
    case 'working': {
      const mission = agent.activeMission;
      const goal = mission?.goalTitle ? `«${mission.goalTitle}»` : t('ag.aMission');
      const attempt = mission?.attempt ? ` · ${t('ag.attemptOf', { n: mission.attempt })}` : '';
      return { tone: 'live', short: t('ag.workingShort', { name }), title: t('ag.workingTitle', { name }), detail: t('ag.workingDetail', { goal, attempt, ago: formatAgo(mission?.claimedAt, nowMs) }) };
    }
    case 'online':
      return { tone: 'ok', short: t('ag.connectedShort', { name }), title: t('ag.connectedShort', { name }), detail: t('ag.onlineDetail', { ago: formatAgo(agent.lastSeenAt, nowMs), via: VIA[agent.lastSeenVia ?? 'poll'], queued }) };
    case 'seen':
      return { tone: 'idle', short: t('ag.pausedShort', { name }), title: t('ag.seenTitle', { name, ago: formatAgo(agent.lastSeenAt, nowMs) }), detail: t('ag.seenDetail', { via: VIA[agent.lastSeenVia ?? 'poll'], queued }) };
    case 'history': {
      const last = agent.lastMission;
      const phase = last?.phase ? PHASES()[last.phase] ?? last.phase : undefined;
      return { tone: 'idle', short: t('ag.noContactShort', { name }), title: t('ag.noContactTitle', { clock: formatClock(agent.kernelStartedAt) }), detail: t('ag.historyDetail', { name, ago: formatAgo(last?.at, nowMs), phase: phase ? ` (${phase})` : '', queued }) };
    }
    default:
      return { tone: 'off', short: t('ag.noAgent'), title: t('ag.noAgentConnected'), detail: t('ag.noContactDetail', { name, queued }) };
  }
}

/** Result of "Probar conexión": passes only when the Kernel itself saw the agent recently. */
export function connectionTestResult(agent: AgentStatus | undefined, available: boolean, nowMs: number): { ok: boolean; message: string } {
  if (!available || !agent) return { ok: false, message: t('ag.cantCheck') };
  if (agent.state === 'working') return { ok: true, message: t('ag.testWorking', { label: agent.label }) };
  if (agent.state === 'online') return { ok: true, message: t('ag.testOnline', { label: agent.label, ago: formatAgo(agent.lastSeenAt, nowMs), via: VIA[agent.lastSeenVia ?? 'poll'] }) };
  const windowMin = Math.round(agent.onlineWindowMs / 60_000);
  const seen = agent.lastSeenAt ? ` ${t('ag.lastContact', { ago: formatAgo(agent.lastSeenAt, nowMs) })}` : '';
  return { ok: false, message: t('ag.testNotYet', { label: agent.label, min: windowMin, seen }) };
}

/**
 * Hermes readiness as one truth for Ajustes and the header: bootstrap.hermes describes the Kernel's
 * own bundled Hermes install; an external worker the Kernel sees online/working is also ready.
 */
export function hermesReadiness(bootstrapHermes: string | undefined, agent: AgentStatus | undefined): { value: string; ready: boolean } {
  if (agent?.state === 'working') return { value: t('ag.workingWorker'), ready: true };
  if (agent?.state === 'online') return { value: t('ag.connectedWorker'), ready: true };
  if (bootstrapHermes) return { value: bootstrapHermes, ready: bootstrapHermes === 'ready' };
  return { value: t('ag.noDiag'), ready: false };
}
