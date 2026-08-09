import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION } from './goal-execution-authorization.mjs';

const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };

describe('consented agent missions', () => {
  it('persists a trusted UI confirmation receipt and reuses it idempotently for a live mission', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find remote AI work', categories: ['job'], keywords: ['remote'], location: 'Madrid' });
    const manager = new AgentMissionManager(store, { now: () => new Date('2026-07-22T18:00:00.000Z') });
    const first = await manager.create(goal.id, { agent: 'hermes', cadence: 'daily', confirmed: true }, interactive);
    const retry = await manager.create(goal.id, { agent: 'hermes', cadence: 'daily', confirmed: true }, interactive);
    expect(first).toMatchObject({
      goalId: goal.id, agent: 'hermes', cadence: 'daily', status: 'waiting_for_agent', scope: { location: 'Madrid' },
      authorization: {
        schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
        goalId: goal.id, goalRevision: 1, decision: 'approved', scope: 'read_only_continuation',
        actorType: 'interactive_user', decidedBy: 'dashboard-ui', decidedAt: '2026-07-22T18:00:00.000Z',
      },
    });
    expect(first.authorization.id).toMatch(/^goal-auth:[a-f0-9]{64}$/);
    expect(retry.authorization).toEqual(first.authorization);
    expect(await manager.list()).toHaveLength(1);
  });

  it('keeps manual mission creation compatible but grants no automation receipt without trusted interactive context', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find useful grants', categories: ['grant'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true });
    await expect(manager.create(goal.id, { agent: 'hermes' })).rejects.toMatchObject({ code: 'INVALID_AGENT_MISSION' });
    expect((await store.read()).agentMissions ?? []).toHaveLength(0);
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    expect(mission).toMatchObject({ status: 'queued' });
    expect(mission.authorization).toBeUndefined();
  });

  it('ignores client-supplied authorization and never promotes it without trusted server context', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find safe tool offers', categories: ['tool'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => new Date('2026-07-22T18:10:00.000Z') });
    const forged = { schemaVersion: GOAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION, id: 'forged-by-agent', goalId: goal.id, goalRevision: 999, decision: 'approved', scope: 'read_only_continuation', actorType: 'agent', decidedBy: 'hermes', decidedAt: '2026-07-22T18:09:00.000Z' };
    const manual = await manager.create(goal.id, { agent: 'hermes', confirmed: true, authorization: forged });
    expect(manual.authorization).toBeUndefined();
    const upgraded = await manager.create(goal.id, { agent: 'hermes', confirmed: true, authorization: forged }, interactive);
    expect(upgraded.authorization).toMatchObject({ goalId: goal.id, goalRevision: 1, actorType: 'interactive_user', decidedBy: 'dashboard-ui' });
    expect(upgraded.authorization.id).not.toBe('forged-by-agent');
  });

  it('adds a receipt to a pre-G4 live mission only after a new trusted interactive confirmation', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find local offers', categories: ['offer'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => new Date('2026-07-22T18:15:00.000Z') });
    const legacy = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    expect(legacy.authorization).toBeUndefined();
    const authorized = await manager.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    expect(authorized.id).toBe(legacy.id);
    expect(authorized.authorization).toMatchObject({ actorType: 'interactive_user', decidedAt: '2026-07-22T18:15:00.000Z' });
  });

  it('mints a fresh receipt when a terminal mission is explicitly restarted from a trusted UI', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find AI funding', categories: ['grant'], keywords: ['AI'] });
    let now = new Date('2026-07-22T18:00:00.000Z');
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => now });
    const first = await manager.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    await store.project(async (data) => {
      const mission = { ...data.agentMissions[0], status: 'failed', attempt: 3, lastFailure: { reason: 'provider timeout' }, completedAt: now.toISOString() };
      return { changed: true, data: { ...data, agentMissions: [mission] }, result: mission };
    });
    now = new Date('2026-07-22T18:30:00.000Z');
    const restarted = await manager.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    expect(restarted).toMatchObject({ id: first.id, status: 'queued', attempt: 0, authorization: { decidedAt: '2026-07-22T18:30:00.000Z' } });
    expect(restarted.authorization.id).not.toBe(first.authorization.id);
  });

  it('preserves authorization provenance through final lease reconciliation', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-missions-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find real funding', categories: ['grant'] });
    const now = new Date('2026-07-22T22:30:00.000Z');
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => now });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    await store.project(async (data) => {
      const stale = { ...data.agentMissions[0], status: 'running', executionPhase: 'investigating', attempt: 3, claimedAt: '2026-07-22T18:00:00.000Z', leaseId: 'stale-lease', leaseExpiresAt: '2026-07-22T18:30:00.000Z' };
      return { changed: true, data: { ...data, agentMissions: [stale] }, result: stale };
    });
    const [reconciled] = await manager.list();
    expect(reconciled).toMatchObject({ status: 'failed', attempt: 3, authorization: mission.authorization });
    expect(reconciled.leaseId).toBeUndefined();
    expect((await store.read()).agentMissions[0].authorization).toEqual(mission.authorization);
  });
});
