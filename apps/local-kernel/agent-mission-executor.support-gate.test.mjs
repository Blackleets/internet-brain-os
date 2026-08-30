import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor as LegacyAgentMissionExecutor } from './agent-mission-executor-legacy.mjs';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const unique = 'xyz-nonexist-token-9f3a';

async function liveFixture(goalInput = { title: `Locate record ${unique} in public filings`, categories: ['offer'], keywords: [unique] }) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-support-gate-')), 'store.json'));
  const goal = await new GoalManager(store).create(goalInput);
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, {
    confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' },
  });
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  return { store, goal, mission, executor, claim };
}

describe('live executor cannot complete from Hermes snippets', () => {
  it('refuses snippet-only complete even when the unique Goal token is echoed', async () => {
    const { store, mission, executor, claim } = await liveFixture();
    await expect(executor.complete(mission.id, {
      leaseId: claim.leaseId,
      findings: [{
        url: 'https://jwt.io/',
        title: `Search result ${unique}`,
        text: `UNTRUSTED SEARCH SNIPPET ${unique}`,
      }],
    })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    const data = await store.read();
    expect(data.agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating' });
    expect(data.agentMissions[0].status).not.toBe('completed');
    expect(data.agentMissions[0].executionPhase).not.toBe('forged');
    expect(data.evidence ?? []).toHaveLength(0);
  });

  it('records jwt.io search candidates without forging Completado', async () => {
    const { store, mission, executor, claim } = await liveFixture();
    const result = await executor.complete(mission.id, {
      leaseId: claim.leaseId,
      resultKind: 'search_candidates',
      findings: [{
        url: 'https://jwt.io/',
        title: `Search result ${unique}`,
        text: `UNTRUSTED SEARCH SNIPPET ${unique}`,
      }],
    });
    expect(result.mission).toMatchObject({ status: 'running', executionPhase: 'verifying' });
    expect(result.mission.status).not.toBe('completed');
    expect(result.mission.executionPhase).not.toBe('forged');
    expect((await store.read()).evidence ?? []).toHaveLength(0);
  });

  it('legacy complete is fail-closed even if imported directly', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-legacy-gate-')), 'store.json'));
    const executor = new LegacyAgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
    await expect(executor.complete('mission:1', {
      leaseId: 'lease-1',
      findings: [{
        url: 'https://jwt.io/',
        title: `Search result ${unique}`,
        text: `UNTRUSTED SEARCH SNIPPET ${unique}`,
      }],
    })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    expect((await store.read()).evidence ?? []).toHaveLength(0);
  });

  it('on-topic drill fetched page still forges through the live verifier path', async () => {
    const { store, mission, executor, claim } = await liveFixture({
      title: 'Find a drill offer',
      categories: ['offer'],
      keywords: ['drill'],
    });
    await executor.complete(mission.id, {
      leaseId: claim.leaseId,
      resultKind: 'search_candidates',
      findings: [{ url: 'https://shop.example/drill', title: 'Search result drill', text: 'UNTRUSTED SEARCH SNIPPET' }],
    });
    const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), {
      kernel,
      reader: {
        fetch: async () => ({
          url: 'https://shop.example/drill',
          title: 'Quality drill 24.99 EUR',
          text: 'Limited offer. Discount deal. Oferta limitada. Descuento y promocion. Quality cordless drill with warranty for 24.99 EUR. Offer ends on August 12 2026.',
          fetchedAt: '2026-08-09T22:19:00.000Z',
          contentType: 'text/html',
          status: 200,
        }),
      },
      now: () => new Date('2026-08-09T22:20:00.000Z'),
    });
    const result = await verifier.verify(mission.id);
    expect(result.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    expect((await store.read()).evidence[0].rawText).toContain('24.99 EUR');
    expect((await store.read()).evidence[0].rawText).not.toContain('UNTRUSTED SEARCH SNIPPET');
  });
});