import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor, SEARCH_TELEMETRY_SCHEMA, normalizeSearchTelemetry } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

// TEST FIXTURES: Kernel-shaped agent results (not product data).
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const finding = { url: 'https://shop.example/drill', title: 'Search result drill', text: 'UNTRUSTED SEARCH SNIPPET' };
const searches = [
  { query: 'drill offer discount', limit: 10, resultCount: 10 },
  { query: '  cordless   drill deal Madrid ', limit: 10 },
  { query: 'drill promotion' },
];
const now = new Date('2026-10-03T21:30:00.000Z');

async function claimed() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-search-telemetry-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false, now: () => now });
  const claim = await executor.claim('hermes', mission.id);
  return { store, mission, executor, claim };
}

describe('per-mission search telemetry (display-only)', () => {
  it('stores the searches the agent reported, bounded and normalized, next to the candidates', async () => {
    const { store, mission, executor, claim } = await claimed();
    const result = await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding], searchTelemetry: { searches } });
    const stored = (await store.read()).agentMissions[0];
    expect(stored.searchTelemetry).toEqual({
      schemaVersion: SEARCH_TELEMETRY_SCHEMA,
      displayOnly: true,
      recordedAt: now.toISOString(),
      searches: [
        { query: 'drill offer discount', limit: 10, resultCount: 10 },
        { query: 'cordless drill deal Madrid', limit: 10 },
        { query: 'drill promotion' },
      ],
    });
    expect(result.mission.searchTelemetry).toEqual(stored.searchTelemetry);
    expect(stored).toMatchObject({ status: 'running', executionPhase: 'verifying' });
    expect(stored.searchCandidates.map((item) => item.url)).toEqual(['https://shop.example/drill']);
  });

  it('drops invalid telemetry without rejecting the results, and never invents missing fields', () => {
    const invalid = [
      undefined, null, 'drill', [], {},
      { searches: [] },
      { searches: [{ query: 'ok' }], extra: true },
      { searches: [{ query: 'ok', snippet: 'copied text' }] },
      { searches: [{ query: '' }] },
      { searches: [{ query: 'x'.repeat(301) }] },
      { searches: [{ query: 'ok', limit: 0 }] },
      { searches: [{ query: 'ok', limit: 101 }] },
      { searches: [{ query: 'ok', limit: 2.5 }] },
      { searches: [{ query: 'ok', resultCount: -1 }] },
      { searches: [{ query: 'ok', resultCount: 1001 }] },
      { searches: [{ query: 'ok', resultCount: '10' }] },
      { searches: [{ query: 42 }] },
      { searches: Array.from({ length: 9 }, () => ({ query: 'ok' })) },
    ];
    for (const value of invalid) expect(normalizeSearchTelemetry(value)).toBeUndefined();
    expect(normalizeSearchTelemetry({ searches: [{ query: 'only the query' }] })).toEqual({ schemaVersion: SEARCH_TELEMETRY_SCHEMA, displayOnly: true, searches: [{ query: 'only the query' }] });
  });

  it('records candidates normally when the telemetry is invalid', async () => {
    const { store, mission, executor, claim } = await claimed();
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding], searchTelemetry: { searches: [{ query: 'ok', limit: 'ten' }] } });
    const stored = (await store.read()).agentMissions[0];
    expect(stored).not.toHaveProperty('searchTelemetry');
    expect(stored.searchCandidates).toHaveLength(1);
  });

  it('keeps telemetry out of the duplicate check: a resent batch with other telemetry is idempotent and unchanged', async () => {
    const { store, mission, executor, claim } = await claimed();
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding], searchTelemetry: { searches } });
    const before = (await store.read()).agentMissions[0];
    const again = await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding], searchTelemetry: { searches: [{ query: 'something else', resultCount: 99 }] } });
    expect(again.idempotent).toBe(true);
    const after = (await store.read()).agentMissions[0];
    expect(after.searchCandidateDigest).toBe(before.searchCandidateDigest);
    expect(after.searchTelemetry).toEqual(before.searchTelemetry);
    // Same candidates without telemetry produce the same digest.
    const other = await claimed();
    await other.executor.complete(other.mission.id, { leaseId: other.claim.leaseId, resultKind: 'search_candidates', findings: [finding] });
    expect((await other.store.read()).agentMissions[0].searchCandidateDigest).toBe(before.searchCandidateDigest);
  });

  it('keeps the telemetry when the searches returned no candidates', async () => {
    const { store, mission, executor, claim } = await claimed();
    const zero = [{ query: 'drill offer discount', limit: 10, resultCount: 0 }];
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [], searchTelemetry: { searches: zero } });
    const stored = (await store.read()).agentMissions[0];
    expect(stored).toMatchObject({ status: 'completed', limitation: 'Public discovery completed with no candidates' });
    expect(stored.searchTelemetry.searches).toEqual(zero);
    // A relaunch (confirmed again) starts a clean attempt: the previous telemetry does not carry over.
    const restarted = await new AgentMissionManager(store, { isAgentReady: () => true }).create(stored.goalId, { agent: 'hermes', confirmed: true }, interactive);
    expect(restarted.id).toBe(mission.id);
    expect(restarted).not.toHaveProperty('searchTelemetry');
  });

  it('never feeds Evidence or SUPPORT: verification is identical with or without telemetry, and keeps it', async () => {
    const page = { url: 'https://shop.example/drill', title: 'Garden furniture', text: 'Garden chairs and tables for your terrace. Weatherproof teak.', fetchedAt: '2026-10-03T21:31:00.000Z', contentType: 'text/html', status: 200 };
    const run = async (telemetry) => {
      const { store, mission, executor, claim } = await claimed();
      await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [finding], ...(telemetry ? { searchTelemetry: telemetry } : {}) });
      const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), { kernel, reader: { fetch: async () => page }, now: () => new Date('2026-10-03T21:31:00.000Z') });
      await verifier.verify(mission.id);
      return store.read();
    };
    // The telemetry queries are full of Goal terms; the page is not. SUPPORT must not move.
    const withTelemetry = await run({ searches: [{ query: 'drill offer discount drill deal', limit: 10, resultCount: 10 }] });
    const without = await run(undefined);
    const strip = (results) => results.map(({ candidateId: _id, evidenceId: _evidence, ...rest }) => rest);
    expect(strip(withTelemetry.agentMissions[0].verificationResults)).toEqual(strip(without.agentMissions[0].verificationResults));
    expect(withTelemetry.agentMissions[0].verificationResults.every((item) => item.supported !== true)).toBe(true);
    expect(withTelemetry.evidence.map((item) => item.rawText)).toEqual(without.evidence.map((item) => item.rawText));
    expect(JSON.stringify(withTelemetry.evidence)).not.toContain('drill offer discount drill deal');
    expect(withTelemetry.opportunities ?? []).toHaveLength(0);
    expect(withTelemetry.agentMissions[0].searchTelemetry.searches[0].query).toBe('drill offer discount drill deal');
  });
});
