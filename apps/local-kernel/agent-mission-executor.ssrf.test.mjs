import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';

function createStore() {
  const state = {
    data: {
      goals: [{ id: 'goal:1', title: 'Probe', categories: ['tool'], keywords: ['x'], status: 'active', priority: 2, createdAt: new Date().toISOString() }],
      agentMissions: [{
        id: 'mission:1', goalId: 'goal:1', goalTitle: 'Probe', agent: 'hermes', cadence: 'manual',
        status: 'running', executionPhase: 'investigating', attempt: 1,
        leaseId: 'lease-1', leaseExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        scope: { categories: ['tool'], keywords: ['x'] },
        createdAt: new Date().toISOString(),
      }],
      evidence: [], cases: [], opportunities: [],
    },
  };
  return {
    read: async () => state.data,
    project: async (fn) => {
      const outcome = await fn(state.data);
      if (outcome.changed) state.data = outcome.data;
      return outcome.result;
    },
  };
}

function createOpportunityProjectionPort() {
  return {
    projectInto(data) {
      return { changed: false, data, result: { status: 'ordinary_evidence' } };
    },
  };
}

const BLOCKED = [
  'http://2130706433/decimal-loopback',
  'http://0x7f000001/hex-loopback',
  'http://127.1/short-loopback',
  'http://100.64.0.1/cgnat',
  'http://198.18.0.1/benchmark',
  'http://192.0.0.1/ietf-protocol',
  'http://[::ffff:127.0.0.1]/mapped-loopback',
  'http://[::ffff:10.0.0.1]/mapped-private',
  'http://224.0.0.1/multicast',
];

describe('agent mission executor SSRF hardening', () => {
  const executor = () => new AgentMissionExecutor(createStore(), createOpportunityProjectionPort());

  for (const url of BLOCKED) {
    it(`rejects ${url}`, async () => {
      await expect(executor().complete('mission:1', {
        leaseId: 'lease-1',
        findings: [{ url, title: 'probe', text: 'bounded probe text' }],
      })).rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
    });
  }

  it('still accepts a genuinely public URL through the transactional projection port', async () => {
    const result = await executor().complete('mission:1', {
      leaseId: 'lease-1',
      findings: [{ url: 'https://example.com/public', title: 'probe', text: 'bounded probe text' }],
    });
    expect(result.mission.status).toBe('completed');
  });
});
