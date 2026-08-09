import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

async function fixture() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-candidates-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find public offers', categories: ['tool'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true });
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  return { store, mission, executor, claim };
}

describe('Hermes search candidates are not Evidence', () => {
  it('persists deduplicated candidates in verifying with zero Evidence or Finds', async () => {
    const { store, mission, executor, claim } = await fixture();
    const input = {
      leaseId: claim.leaseId,
      resultKind: 'search_candidates',
      findings: [
        { url: 'https://shop.example/drill', title: 'Drill', text: 'Search snippet A' },
        { url: 'https://shop.example/drill', title: 'Duplicate', text: 'Search snippet B' },
      ],
    };
    const result = await executor.complete(mission.id, input);
    expect(result.mission).toMatchObject({
      status: 'running', executionPhase: 'verifying',
      resultSummary: { received: 2, evidenceCreated: 0, opportunitiesPromoted: 0 },
      limitation: 'Search candidates await Kernel web.read verification',
    });
    expect(result.mission.searchCandidates).toHaveLength(1);
    expect(result.mission.searchCandidates[0]).toMatchObject({ status: 'pending_verification', url: 'https://shop.example/drill' });
    expect(result.mission.leaseId).toBeUndefined();
    const data = await store.read();
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.cases ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
  });

  it('treats an exact candidate-result replay as idempotent', async () => {
    const { store, mission, executor, claim } = await fixture();
    const input = { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url: 'https://example.com/a', title: 'A', text: 'Snippet' }] };
    const first = await executor.complete(mission.id, input);
    const beforeReplay = await store.read();
    const replay = await executor.complete(mission.id, input);
    expect(first.mission.executionPhase).toBe('verifying');
    expect(replay.idempotent).toBe(true);
    expect(await store.read()).toEqual(beforeReplay);
  });

  it('completes calmly with zero candidates and never claims forged Evidence', async () => {
    const { store, mission, executor, claim } = await fixture();
    const result = await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [] });
    expect(result.mission).toMatchObject({
      status: 'completed',
      limitation: 'Public discovery completed with no candidates',
      resultSummary: { received: 0, evidenceCreated: 0, opportunitiesPromoted: 0 },
    });
    expect(result.mission.executionPhase).toBeUndefined();
    expect(result.mission.forgedAt).toBeUndefined();
    expect((await store.read()).evidence ?? []).toHaveLength(0);
  });
});
