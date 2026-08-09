import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };

async function fixture(reader) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-web-read-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  await executor.complete(mission.id, {
    leaseId: claim.leaseId,
    resultKind: 'search_candidates',
    findings: [{ url: 'https://shop.example/drill', title: 'Search result drill', text: 'UNTRUSTED SEARCH SNIPPET' }],
  });
  return {
    store,
    goal,
    mission,
    verifier: new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), {
      kernel,
      reader,
      now: () => new Date('2026-08-09T22:20:00.000Z'),
    }),
  };
}

function verifiedPage() {
  return {
    url: 'https://shop.example/drill',
    title: 'Quality drill 24.99 EUR',
    text: 'Limited offer. Discount deal. Quality cordless drill with warranty for 24.99 EUR. Offer ends on August 12 2026.',
    fetchedAt: '2026-08-09T22:19:00.000Z',
    contentType: 'text/html',
    status: 200,
  };
}

describe('Kernel-owned search candidate verification', () => {
  it('uses fetched web.read content, never the Hermes snippet, as Evidence', async () => {
    const calls = [];
    const { store, mission, verifier } = await fixture({ fetch: async (url) => { calls.push(url); return verifiedPage(); } });
    const result = await verifier.verify(mission.id);
    expect(calls).toEqual(['https://shop.example/drill']);
    expect(result.mission).toMatchObject({
      status: 'completed', executionPhase: 'forged',
      resultSummary: { received: 1, evidenceCreated: 1, opportunitiesPromoted: 1 },
      limitation: 'Kernel web.read verification completed; only fetched page content became Evidence',
    });
    const data = await store.read();
    expect(data.evidence).toHaveLength(1);
    expect(data.evidence[0]).toMatchObject({
      sourceUrl: 'https://shop.example/drill', extractionMethod: 'kernel-web-read-v1', confidence: 0.9,
      tags: ['kernel-verified', 'web.read'], missionId: mission.id,
    });
    expect(data.evidence[0].rawText).toContain('24.99 EUR');
    expect(data.evidence[0].rawText).not.toContain('UNTRUSTED SEARCH SNIPPET');
    expect(data.opportunities).toHaveLength(1);
    expect(data.agentMissions[0].searchCandidates[0]).toMatchObject({ status: 'verified', evidenceId: data.evidence[0].id });
  });

  it('replays completed verification idempotently without duplicate Evidence or Finds', async () => {
    const { store, mission, verifier } = await fixture({ fetch: async () => verifiedPage() });
    await verifier.verify(mission.id);
    const before = await store.read();
    const replay = await verifier.verify(mission.id);
    expect(replay.idempotent).toBe(true);
    expect(await store.read()).toEqual(before);
  });

  it('rechecks Goal authority after network read and refuses persistence if the Goal was paused', async () => {
    let store;
    const prepared = await fixture({
      fetch: async () => {
        await store.project(async (data) => ({
          changed: true,
          data: { ...data, goals: data.goals.map((goal) => ({ ...goal, status: 'paused' })) },
        }));
        return verifiedPage();
      },
    });
    store = prepared.store;
    const result = await prepared.verifier.verify(prepared.mission.id);
    expect(result.blocked).toBe(true);
    expect(result.mission.verificationBlock.reason).toBe('goal_not_active');
    const data = await store.read();
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
  });

  it('keeps the Mission in verifying with zero Evidence when every web.read fails', async () => {
    const { store, mission, verifier } = await fixture({ fetch: async () => { throw new Error('network unavailable'); } });
    const result = await verifier.verify(mission.id);
    expect(result.mission).toMatchObject({
      status: 'running', executionPhase: 'verifying',
      resultSummary: { received: 1, evidenceCreated: 0, opportunitiesPromoted: 0 },
      limitation: 'Kernel web.read verification failed for all candidates; retry remains safe',
    });
    expect(result.mission.verificationResults[0]).toMatchObject({ status: 'verification_failed' });
    expect((await store.read()).evidence ?? []).toHaveLength(0);
  });
});
