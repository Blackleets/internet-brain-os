import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';

describe('consented agent missions', () => {
  it('creates an idempotent bounded mission and waits honestly for disconnected Hermes', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find remote AI work', categories: ['job'], keywords: ['remote'], location: 'Madrid' });
    const manager = new AgentMissionManager(store, { now: () => new Date('2026-07-22T18:00:00.000Z') });
    const first = await manager.create(goal.id, { agent: 'hermes', cadence: 'daily', confirmed: true });
    const retry = await manager.create(goal.id, { agent: 'hermes', cadence: 'daily', confirmed: true });
    expect(first).toMatchObject({ goalId: goal.id, agent: 'hermes', cadence: 'daily', status: 'waiting_for_agent', scope: { location: 'Madrid' } });
    expect(retry.id).toBe(first.id);
    expect(await manager.list()).toHaveLength(1);
  });

  it('requires consent and only queues a mission when its adapter is ready', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find useful grants', categories: ['grant'] });
    const manager = new AgentMissionManager(store, { isAgentReady: (agent) => agent === 'hermes' });
    await expect(manager.create(goal.id, { agent: 'hermes' })).rejects.toMatchObject({ code: 'INVALID_AGENT_MISSION' });
    await expect(manager.create(goal.id, { agent: 'openclaw', confirmed: true })).rejects.toMatchObject({ code: 'INVALID_AGENT_MISSION' });
    await expect(manager.create(goal.id, { agent: 'hermes', confirmed: true })).resolves.toMatchObject({ status: 'queued' });
  });
});
