import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';

function mission(id) {
  return {
    id, goalId: `goal:${id}`, goalTitle: `Goal ${id}`, agent: 'hermes', cadence: 'manual',
    status: 'queued', executionPhase: 'queued', attempt: 0,
    scope: { categories: ['tool'], keywords: ['x'] },
    createdAt: new Date().toISOString(),
  };
}

function createStore() {
  const state = { data: { agentMissions: [mission('mission:a'), mission('mission:b')], evidence: [], cases: [] } };
  return {
    read: async () => state.data,
    project: async (fn) => {
      const outcome = await fn(state.data);
      if (outcome.changed) state.data = outcome.data;
      return outcome.result;
    },
    peek: () => state.data,
  };
}

describe('mission-scoped claim', () => {
  it('claims exactly the requested mission and never a different queued one', async () => {
    const store = createStore();
    const executor = new AgentMissionExecutor(store, { project: async () => ({ status: 'noise' }) });
    const claimed = await executor.claim('hermes', 'mission:b');
    expect(claimed.id).toBe('mission:b');

    const other = store.peek().agentMissions.find((item) => item.id === 'mission:a');
    expect(other.status).toBe('queued');
    expect(other.attempt).toBe(0);
  });

  it('does not burn the attempt counter of an unrelated mission', async () => {
    const store = createStore();
    const executor = new AgentMissionExecutor(store, { project: async () => ({ status: 'noise' }) });
    await executor.claim('hermes', 'mission:a');
    await executor.claim('hermes', 'mission:a');
    const b = store.peek().agentMissions.find((item) => item.id === 'mission:b');
    expect(b.attempt).toBe(0);
  });

  it('returns undefined when the requested mission is not claimable', async () => {
    const store = createStore();
    const executor = new AgentMissionExecutor(store, { project: async () => ({ status: 'noise' }) });
    expect(await executor.claim('hermes', 'mission:missing')).toBeUndefined();
  });

  it('remains backward compatible when no missionId is supplied', async () => {
    const store = createStore();
    const executor = new AgentMissionExecutor(store, { project: async () => ({ status: 'noise' }) });
    const claimed = await executor.claim('hermes');
    expect(claimed).toBeDefined();
    expect(['mission:a', 'mission:b']).toContain(claimed.id);
  });
});
