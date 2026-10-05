import { describe, expect, it } from 'vitest';
import { parseAgents } from './agents';
import { agentConnectionCopy, connectionTestResult, formatAgo } from './agent-connection-copy';

const NOW = Date.parse('2026-10-04T12:00:00.000Z');
const base = { id: 'hermes', label: 'Hermes Agent', onlineWindowMs: 120_000, queuedMissions: 0 };

describe('parseAgents (fail-closed)', () => {
  it('rejects anything that is not efesto.agents.v1', () => {
    expect(() => parseAgents({ ok: true, agents: [] })).toThrow();
    expect(() => parseAgents({ ok: false, schemaVersion: 'efesto.agents.v1', agents: [] })).toThrow();
    expect(() => parseAgents(null)).toThrow();
  });
  it('drops agents with an unknown state instead of guessing one', () => {
    const parsed = parseAgents({ ok: true, schemaVersion: 'efesto.agents.v1', agents: [{ id: 'hermes', state: 'connected' }, { ...base, state: 'online', lastSeenAt: 'nope', lastSeenVia: 'ping' }] });
    expect(parsed.agents).toHaveLength(1);
    expect(parsed.agents[0]).toMatchObject({ state: 'online', lastSeenAt: undefined, lastSeenVia: 'ping' });
  });
});

describe('agentConnectionCopy', () => {
  it('says the Kernel does not publish agent status instead of inventing one', () => {
    expect(agentConnectionCopy(undefined, false, NOW)).toMatchObject({ tone: 'off', title: 'Estado de agentes no disponible' });
  });
  it('names each Kernel state honestly', () => {
    expect(agentConnectionCopy({ ...base, state: 'never' }, true, NOW)).toMatchObject({ tone: 'off', title: 'Ningún agente conectado' });
    expect(agentConnectionCopy({ ...base, state: 'online', lastSeenAt: '2026-10-04T11:59:48.000Z', lastSeenVia: 'ping' }, true, NOW)).toMatchObject({ tone: 'ok', title: 'Hermes conectado', detail: expect.stringContaining('hace 12 s (comprobación del doctor)') });
    expect(agentConnectionCopy({ ...base, state: 'seen', lastSeenAt: '2026-10-04T11:52:00.000Z', lastSeenVia: 'result' }, true, NOW)).toMatchObject({ tone: 'idle', title: 'Hermes visto hace 8 min' });
    const history = agentConnectionCopy({ ...base, state: 'history', kernelStartedAt: '2026-10-04T10:00:00.000Z', lastMission: { id: 'm', phase: 'forged', at: '2026-10-04T10:39:47.000Z' }, queuedMissions: 2 }, true, NOW);
    expect(history.title).toMatch(/^Sin contacto desde que arrancó el Kernel/);
    expect(history.detail).toContain('(forjada)');
    expect(history.detail).toContain('2 misiones esperan a un agente.');
    expect(agentConnectionCopy({ ...base, state: 'working', activeMission: { id: 'm', goalTitle: 'rider', attempt: 2, claimedAt: '2026-10-04T11:58:00.000Z' } }, true, NOW)).toMatchObject({ tone: 'live', title: 'Hermes está trabajando', detail: 'Investiga «rider» · intento 2 de 3 · reclamada hace 2 min.' });
  });
});

describe('agentConnectionCopy: last Mission phase never reads as finished work without Kernel SUPPORT', () => {
  const history = (phase: string) => agentConnectionCopy({ ...base, state: 'history', kernelStartedAt: '2026-10-04T10:00:00.000Z', lastMission: { id: 'm', phase, at: '2026-10-04T10:39:47.000Z' } }, true, NOW).detail;
  it('a completed Mission without a forge is "terminada sin Evidence", not "completada"', () => {
    expect(history('completed')).toContain('(terminada sin Evidence)');
    expect(history('completed')).not.toContain('completada');
    expect(history('completed_without_forge')).toContain('(terminada sin Evidence)');
    expect(history('forged')).toContain('(forjada)');
  });
});

describe('connectionTestResult: passes only on a recent Kernel-observed contact', () => {
  it('fails for history/seen/never and when the Kernel does not publish agents', () => {
    expect(connectionTestResult({ ...base, state: 'history' }, true, NOW).ok).toBe(false);
    expect(connectionTestResult({ ...base, state: 'seen', lastSeenAt: '2026-10-04T11:00:00.000Z' }, true, NOW).message).toContain('El último contacto fue hace 1 h.');
    expect(connectionTestResult({ ...base, state: 'never' }, true, NOW).message).toContain('últimos 2 min');
    expect(connectionTestResult(undefined, false, NOW)).toEqual({ ok: false, message: 'No se pudo comprobar: este Kernel no publica el estado de agentes.' });
  });
  it('passes for online and working', () => {
    expect(connectionTestResult({ ...base, state: 'online', lastSeenAt: '2026-10-04T11:59:58.000Z', lastSeenVia: 'poll' }, true, NOW)).toEqual({ ok: true, message: 'Funciona: el Kernel recibió a Hermes Agent hace 2 s (buscó misiones).' });
    expect(connectionTestResult({ ...base, state: 'working' }, true, NOW).ok).toBe(true);
  });
  it('formatAgo', () => {
    expect(formatAgo(undefined, NOW)).toBe('sin fecha');
    expect(formatAgo('2026-10-03T12:00:00.000Z', NOW)).toBe('hace 1 d');
  });
});
