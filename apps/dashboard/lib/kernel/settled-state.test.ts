import { describe, expect, it } from 'vitest';
import { agentConnectionCopy, hermesReadiness } from './agent-connection-copy';
import { settledWorkState } from '../forge/forge-model';
import type { AgentStatus } from './agents';
import type { MissionSummary } from './contracts';

const now = Date.parse('2026-10-13T10:20:00Z');
const working: AgentStatus = { id: 'hermes', label: 'Hermes Agent', state: 'working', lastSeenAt: '2026-10-13T10:19:30Z', activeMission: { id: 'mission:1', goalTitle: 'g', attempt: 3, claimedAt: '2026-10-13T10:10:00Z' } } as AgentStatus;

describe('surfaces update as soon as a Mission settles', () => {
  it('the connector stops saying "trabajando · intento 3 de 3" once the Mission is failed in the same refresh', () => {
    expect(agentConnectionCopy(working, true, now).short).toMatch(/trabajando/);
    const settled = agentConnectionCopy(working, true, now, [{ id: 'mission:1', status: 'failed' }]);
    expect(settled.short).not.toMatch(/trabajando/);
    expect(settled.detail).not.toMatch(/intento 3 de 3/);
    // still working when the Mission really is running
    expect(agentConnectionCopy(working, true, now, [{ id: 'mission:1', status: 'running' }]).short).toMatch(/trabajando/);
  });

  it('the forge prefers a settled Mission row over a surface that still says running', () => {
    const failed = { id: 'mission:1', status: 'failed' } as unknown as MissionSummary;
    const forged = { id: 'mission:1', status: 'completed', executionPhase: 'forged' } as unknown as MissionSummary;
    expect(settledWorkState('running', failed)).toBe('failed');
    expect(settledWorkState('investigating', forged)).toBe('forged');
    expect(settledWorkState('verifying', { id: 'mission:1', status: 'running' } as unknown as MissionSummary)).toBe('verifying');
    expect(settledWorkState('failed', undefined)).toBe('failed');
  });
});

describe('Hermes readiness is one truth', () => {
  it('an external worker the Kernel sees online is ready, even when the bundled install is missing', () => {
    expect(hermesReadiness('missing', { ...working, state: 'online', activeMission: undefined } as AgentStatus)).toEqual({ value: 'conectado (worker)', ready: true });
    expect(hermesReadiness('missing', undefined)).toEqual({ value: 'missing', ready: false });
    expect(hermesReadiness(undefined, undefined)).toEqual({ value: 'sin diagnóstico', ready: false });
  });
});
