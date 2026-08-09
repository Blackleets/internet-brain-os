import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

async function fixture() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-auto-claim-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find public tool offers', categories: ['tool'], keywords: ['drill'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true });
  return { store, goal, mission };
}

describe('automatic Mission lease enforcement', () => {
  it('evaluates authorization before attempt increment and grants a lease only after allow', async () => {
    const { store, goal, mission } = await fixture();
    const evaluate = vi.fn(async (receivedGoal, receivedMission) => {
      expect(receivedGoal.id).toBe(goal.id);
      expect(receivedMission.id).toBe(mission.id);
      expect(receivedMission.attempt ?? 0).toBe(0);
      expect(receivedMission.leaseId).toBeUndefined();
      return { allowed: true, capabilityIds: ['web.search'] };
    });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), {
      automaticClaimGate: { evaluate },
      now: () => new Date('2026-08-09T21:00:00.000Z'),
    });

    const claim = await executor.claim('hermes', mission.id);
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(claim).toMatchObject({ id: mission.id, attempt: 1 });
    expect(claim.leaseId).toEqual(expect.any(String));
    expect((await store.read()).agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating', attempt: 1 });
  });

  it('persists a truthful policy block without burning attempts or creating a lease', async () => {
    const { store, mission } = await fixture();
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), {
      automaticClaimGate: { evaluate: async () => ({ allowed: false, reason: 'authorization_missing' }) },
    });

    expect(await executor.claim('hermes', mission.id)).toBeUndefined();
    const [blocked] = (await store.read()).agentMissions;
    expect(blocked).toMatchObject({
      id: mission.id,
      status: 'queued',
      attempt: 0,
      automaticBlock: { reason: 'authorization_missing' },
      limitation: 'Automatic read-only continuation blocked: authorization_missing',
    });
    expect(blocked.leaseId).toBeUndefined();

    const beforeReplay = await store.read();
    expect(await executor.claim('hermes', mission.id)).toBeUndefined();
    expect(await store.read()).toEqual(beforeReplay);
  });

  it('does not mutate Mission state when the Kernel authorization gate is unavailable', async () => {
    const { store, mission } = await fixture();
    const before = await store.read();
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), {
      automaticClaimGate: { evaluate: async () => { throw new Error('trusted Kernel unavailable'); } },
    });

    await expect(executor.claim('hermes', mission.id)).rejects.toThrow('trusted Kernel unavailable');
    expect(await store.read()).toEqual(before);
  });

  it('keeps explicit non-automatic executor composition backward compatible', async () => {
    const { store, mission } = await fixture();
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
    await expect(executor.claim('hermes', mission.id)).resolves.toMatchObject({ id: mission.id, attempt: 1 });
  });
});
