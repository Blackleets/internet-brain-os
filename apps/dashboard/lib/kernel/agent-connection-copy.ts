import type { AgentContactKind, AgentStatus } from './agents';

export type AgentTone = 'live' | 'ok' | 'idle' | 'off';
export type AgentCopy = { tone: AgentTone; title: string; detail: string; short: string };

const VIA: Record<AgentContactKind, string> = {
  ping: 'comprobación del doctor',
  poll: 'buscó misiones',
  claim: 'reclamó una misión',
  result: 'entregó resultados',
  failure: 'informó un fallo',
};

export function formatAgo(fromIso: string | undefined, nowMs: number): string {
  const at = fromIso ? Date.parse(fromIso) : Number.NaN;
  if (!Number.isFinite(at)) return 'sin fecha';
  const seconds = Math.max(0, Math.round((nowMs - at) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function formatClock(iso: string | undefined): string {
  const at = iso ? new Date(iso) : undefined;
  if (!at || Number.isNaN(at.getTime())) return '—';
  return at.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

const PHASES: Record<string, string> = { forged: 'forjada', verifying: 'verificando', investigating: 'investigando', failed: 'fallida', queued: 'en cola', completed: 'completada', running: 'en curso' };

/**
 * Human copy for one agent, derived only from the Kernel's own state. `available === false` means
 * the Kernel does not publish /api/agents (older build): we say that instead of guessing.
 */
export function agentConnectionCopy(agent: AgentStatus | undefined, available: boolean, nowMs: number): AgentCopy {
  if (!available || !agent) {
    return { tone: 'off', short: 'Sin estado', title: 'Estado de agentes no disponible', detail: 'Este Kernel no publica /api/agents. Actualízalo para ver conexiones reales; no mostramos una conexión que no podamos comprobar.' };
  }
  const name = agent.label.replace(/ Agent$/, '');
  const queued = agent.queuedMissions > 0 ? ` ${agent.queuedMissions === 1 ? '1 misión espera' : `${agent.queuedMissions} misiones esperan`} a un agente.` : '';
  switch (agent.state) {
    case 'working': {
      const mission = agent.activeMission;
      const goal = mission?.goalTitle ? `«${mission.goalTitle}»` : 'una misión';
      const attempt = mission?.attempt ? ` · intento ${mission.attempt} de 3` : '';
      return { tone: 'live', short: `${name} trabajando`, title: `${name} está trabajando`, detail: `Investiga ${goal}${attempt} · reclamada ${formatAgo(mission?.claimedAt, nowMs)}.` };
    }
    case 'online':
      return { tone: 'ok', short: `${name} conectado`, title: `${name} conectado`, detail: `Último contacto ${formatAgo(agent.lastSeenAt, nowMs)} (${VIA[agent.lastSeenVia ?? 'poll']}).${queued}` };
    case 'seen':
      return { tone: 'idle', short: `${name} en pausa`, title: `${name} visto ${formatAgo(agent.lastSeenAt, nowMs)}`, detail: `Último contacto: ${VIA[agent.lastSeenVia ?? 'poll']}. El worker trabaja por ciclos; déjalo en bucle (paso 4) para que recoja misiones nuevas.${queued}` };
    case 'history': {
      const last = agent.lastMission;
      const phase = last?.phase ? PHASES[last.phase] ?? last.phase : undefined;
      return { tone: 'idle', short: `${name} sin contacto`, title: `Sin contacto desde que arrancó el Kernel (${formatClock(agent.kernelStartedAt)})`, detail: `${name} trabajó aquí antes: última misión ${formatAgo(last?.at, nowMs)}${phase ? ` (${phase})` : ''}. Arranca el worker para que vuelva a recoger misiones.${queued}` };
    }
    default:
      return { tone: 'off', short: 'Sin agente', title: 'Ningún agente conectado', detail: `El Kernel aún no ha recibido ningún contacto de un agente. Sigue los pasos para conectar ${name}.${queued}` };
  }
}

/** Result of "Probar conexión": passes only when the Kernel itself saw the agent recently. */
export function connectionTestResult(agent: AgentStatus | undefined, available: boolean, nowMs: number): { ok: boolean; message: string } {
  if (!available || !agent) return { ok: false, message: 'No se pudo comprobar: este Kernel no publica el estado de agentes.' };
  if (agent.state === 'working') return { ok: true, message: `Funciona: ${agent.label} tiene una misión en curso en este Kernel.` };
  if (agent.state === 'online') return { ok: true, message: `Funciona: el Kernel recibió a ${agent.label} ${formatAgo(agent.lastSeenAt, nowMs)} (${VIA[agent.lastSeenVia ?? 'poll']}).` };
  const windowMin = Math.round(agent.onlineWindowMs / 60_000);
  const seen = agent.lastSeenAt ? ` El último contacto fue ${formatAgo(agent.lastSeenAt, nowMs)}.` : '';
  return { ok: false, message: `Aún no: el Kernel no ha recibido a ${agent.label} en los últimos ${windowMin} min.${seen} Ejecuta el doctor (paso 3) en la máquina del agente y vuelve a probar.` };
}
