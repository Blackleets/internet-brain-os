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
    it(`rejects ${url} as snippet Completado`, async () => {
      await expect(executor().complete('mission:1', {
        leaseId: 'lease-1',
        findings: [{ url, title: 'probe', text: 'bounded probe text' }],
      })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    });
  }

  it('does not forge Completado from a public URL snippet without Kernel SUPPORT', async () => {
    await expect(executor().complete('mission:1', {
      leaseId: 'lease-1',
      findings: [{ url: 'https://example.com/public', title: 'probe', text: 'bounded probe text' }],
    })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
  });

  const PRIVATE_SEARCH_CANDIDATE_URLS = [
    'http://192.168.1.2/finding',
    'http://10.0.0.1/finding',
    'http://127.0.0.1/finding',
    'http://[::1]/finding',
    'http://[fd00::1]/finding',
    'http://[fc00::1]/finding',
    'http://[fe80::1]/finding',
    'http://[::ffff:127.0.0.1]/mapped-loopback',
    'http://[::ffff:10.0.0.1]/mapped-private',
    'http://[::ffff:192.168.1.2]/mapped-rfc1918',
  ];

  for (const url of PRIVATE_SEARCH_CANDIDATE_URLS) {
    it(`rejects ${url} as search_candidates`, async () => {
      const store = createStore();
      const agent = new AgentMissionExecutor(store, createOpportunityProjectionPort());
      await expect(agent.complete('mission:1', {
        leaseId: 'lease-1',
        resultKind: 'search_candidates',
        findings: [{ url, title: 'probe', text: 'bounded probe text' }],
      })).rejects.toMatchObject({
        code: 'INVALID_AGENT_RESULT',
        message: expect.stringContaining('URL contains private or sensitive data'),
      });
      const mission = (await store.read()).agentMissions[0];
      expect(mission.searchCandidates).toBeUndefined();
      expect(mission.executionPhase).toBe('investigating');
      expect(mission.executionPhase).not.toBe('forged');
      expect(mission.status).toBe('running');
    });
  }

  it('records a public IPv6 URL as search_candidates without forging', async () => {
    const store = createStore();
    const agent = new AgentMissionExecutor(store, createOpportunityProjectionPort());
    const result = await agent.complete('mission:1', {
      leaseId: 'lease-1',
      resultKind: 'search_candidates',
      findings: [{ url: 'http://[2001:4860:4860::8888]/finding', title: 'probe', text: 'bounded probe text' }],
    });
    expect(result.mission.executionPhase).toBe('verifying');
    expect(result.mission.searchCandidates).toHaveLength(1);
    expect(result.mission.executionPhase).not.toBe('forged');
    expect(result.mission.status).not.toBe('completed');
  });
});
