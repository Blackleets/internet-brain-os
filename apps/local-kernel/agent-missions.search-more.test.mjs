import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionEvidenceReader } from './mission-evidence-reader.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

// TEST FIXTURES: Kernel-shaped pages and agent results (not product data).
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const page = (url, price) => ({
  url,
  title: `Quality drill ${price} EUR`,
  text: `Limited offer. Discount deal. Oferta limitada. Descuento y promocion. Quality cordless drill with warranty for ${price} EUR. Offer ends on August 12 2026.`,
  fetchedAt: '2026-08-09T22:19:00.000Z', contentType: 'text/html', status: 200,
});

async function fixture() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-search-more-')), 'store.json'));
  const goal = await new GoalManager(store).create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
  const missions = new AgentMissionManager(store, { isAgentReady: () => true });
  const mission = await missions.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const attempt = async (url, price) => {
    const claim = await executor.claim('hermes', mission.id);
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url, title: 'Search result', text: 'UNTRUSTED SEARCH SNIPPET' }] });
    const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), { kernel, reader: { fetch: async () => page(url, price) }, now: () => new Date('2026-08-09T22:20:00.000Z') });
    return { claim, verified: await verifier.verify(mission.id) };
  };
  return { store, goal, missions, mission, executor, attempt };
}

const searchMore = { agent: 'hermes', confirmed: true, mode: 'search_more' };

describe('"Buscar más": a finished Mission searches again without erasing earlier Finds', () => {
  it('recovers a historical revision denial only through a fresh interactive attempt and keeps its denial and Finds', async () => {
    const { store, goal, missions, mission, executor, attempt } = await fixture();
    await attempt('https://shop.example/drill', '24.99');
    await missions.create(goal.id, searchMore, interactive);
    const claim = await executor.claim('hermes', mission.id);
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url: 'https://stale.example/drill', title: 'Old result', text: 'UNTRUSTED SEARCH SNIPPET' }] });
    // Historical TEST FIXTURE: emulate persisted data from before the Goal edit guard.
    const data = await store.read();
    await store.write({ ...data, goals: data.goals.map((item) => item.id === goal.id ? { ...item, revision: 2 } : item) });
    let reads = 0;
    const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), { kernel, reader: { fetch: async () => { reads += 1; throw new Error('stale batch must not be read'); } } });
    const denied = await verifier.verify(mission.id);
    expect(denied.mission.verificationBlock).toEqual({ reason: 'authorization_revision_mismatch' });
    expect(reads).toBe(0);
    const before = await store.read();
    await expect(missions.create(goal.id, searchMore, {})).rejects.toMatchObject({ status: 403 });
    expect(await store.read()).toEqual(before);

    const recovered = await missions.create(goal.id, searchMore, interactive);
    expect(recovered).toMatchObject({ id: mission.id, status: 'queued', attempt: 0, authorization: { goalRevision: 2, actorType: 'interactive_user' } });
    expect(recovered).not.toHaveProperty('verificationBlock');
    expect(recovered).not.toHaveProperty('searchCandidates');
    expect(recovered.priorAttempts).toHaveLength(2);
    expect(recovered.priorAttempts[1]).toMatchObject({ verificationBlock: { reason: 'authorization_revision_mismatch' }, searchCandidates: [{ url: 'https://stale.example/drill' }] });
    expect(JSON.stringify(recovered.priorAttempts)).not.toContain('UNTRUSTED SEARCH SNIPPET');
    const queued = await store.read();
    expect(queued.evidence).toEqual(before.evidence);
    expect(queued.opportunities).toEqual(before.opportunities);
    expect((await attempt('https://fresh.example/drill', '19.99')).verified.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    expect((await store.read()).evidence).toHaveLength(2);
    expect((await store.read()).opportunities).toHaveLength(2);
  });

  it('does not replace an attempt that acquired a live lease before the recovery request', async () => {
    const { store, goal, missions, mission, executor } = await fixture();
    await executor.claim('hermes', mission.id);
    const before = await store.read();
    expect(await missions.create(goal.id, searchMore, interactive)).toEqual(before.agentMissions[0]);
    expect(await store.read()).toEqual(before);
  });

  it('keeps the earlier attempt, its Evidence and its Find; the new attempt adds to them', async () => {
    const { store, goal, missions, mission, attempt } = await fixture();
    const first = await attempt('https://shop.example/drill', '24.99');
    expect(first.verified.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    const before = await store.read();
    expect(before.evidence).toHaveLength(1);
    const findsBefore = (before.opportunities ?? []).length;
    expect(findsBefore).toBe(1);

    const queued = await missions.create(goal.id, searchMore, interactive);
    expect(queued).toMatchObject({ id: mission.id, status: 'queued', attempt: 0, searchMode: 'search_more', knownSourceUrls: ['https://shop.example/drill'] });
    expect(queued.authorization).toMatchObject({ actorType: 'interactive_user', decidedBy: 'dashboard-ui' });
    expect(queued).not.toHaveProperty('searchCandidates');
    expect(queued.priorAttempts).toHaveLength(1);
    expect(queued.priorAttempts[0]).toMatchObject({ status: 'completed', executionPhase: 'forged', searchCandidates: [{ url: 'https://shop.example/drill' }] });
    expect(queued.priorAttempts[0].verificationResults[0]).toMatchObject({ status: 'verified', supported: true, sourceUrl: 'https://shop.example/drill' });
    expect(JSON.stringify(queued.priorAttempts)).not.toContain('UNTRUSTED SEARCH SNIPPET');
    // Evidence and Finds are untouched by the relaunch itself.
    const afterQueue = await store.read();
    expect(afterQueue.evidence).toEqual(before.evidence);
    expect(afterQueue.opportunities).toEqual(before.opportunities);

    const second = await attempt('https://other.example/drill-offer', '19.99');
    // The agent is told which pages it already brought.
    expect(second.claim.knownSourceUrls).toEqual(['https://shop.example/drill']);
    expect(second.verified.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    const after = await store.read();
    expect(after.evidence).toHaveLength(2);
    expect(after.opportunities).toHaveLength(findsBefore + 1);
    expect(after.agentMissions[0].priorAttempts).toHaveLength(1);

    // The Mission's Evidence view lists the new attempt first, then the kept one, marked.
    const listed = await new MissionEvidenceReader(store).list(mission.id);
    expect(listed.evidence.map((item) => [item.sourceUrl, item.supported, item.priorAttempt === true])).toEqual([
      ['https://other.example/drill-offer', true, false],
      ['https://shop.example/drill', true, true],
    ]);
  });

  it('needs the interactive confirmation, a finished Mission, and a known mode', async () => {
    const { store, goal, missions, mission, attempt } = await fixture();
    // not finished yet (queued): searching more is refused only when there is nothing to keep
    expect(await missions.create(goal.id, searchMore, interactive)).toMatchObject({ id: mission.id, status: 'queued' });
    // inactive but never ran an attempt (e.g. an agent that was never connected): nothing to search "more" of
    const data = await store.read();
    await store.write({ ...data, agentMissions: [{ ...data.agentMissions[0], status: 'failed', executionPhase: 'failed' }] });
    await expect(missions.create(goal.id, searchMore, interactive)).rejects.toMatchObject({ code: 'MISSION_NOT_FINISHED', status: 409 });
    await store.write(data);
    await attempt('https://shop.example/drill', '24.99');
    const snapshot = (await store.read()).agentMissions[0];
    await expect(missions.create(goal.id, searchMore, {})).rejects.toMatchObject({ code: 'MISSION_CONFIRMATION_REQUIRED', status: 403 });
    await expect(missions.create(goal.id, { ...searchMore, mode: 'everything' }, interactive)).rejects.toMatchObject({ code: 'INVALID_AGENT_MISSION', status: 400 });
    expect((await store.read()).agentMissions[0]).toEqual(snapshot);
    // a Goal with no Mission yet cannot "search more"
    const other = await new GoalManager(store).create({ title: 'Find a saw offer', categories: ['offer'], keywords: ['saw'] });
    await expect(missions.create(other.id, searchMore, interactive)).rejects.toMatchObject({ code: 'AGENT_MISSION_NOT_FOUND', status: 404 });
    // the plain relaunch keeps its previous meaning: a clean attempt with no kept history
    const plain = await missions.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    expect(plain).not.toHaveProperty('priorAttempts');
    expect(plain).not.toHaveProperty('searchMode');
    expect((await store.read()).opportunities).toHaveLength(1);
  });

  it('keeps at most five earlier attempts and at most forty known pages', async () => {
    const { goal, missions, attempt } = await fixture();
    let last;
    for (let index = 0; index < 7; index += 1) {
      await attempt(`https://shop${index}.example/drill`, `${20 + index}.99`);
      last = await missions.create(goal.id, searchMore, interactive);
    }
    expect(last.priorAttempts).toHaveLength(5);
    expect(last.priorAttempts.map((item) => item.searchCandidates[0].url)).toEqual([2, 3, 4, 5, 6].map((index) => `https://shop${index}.example/drill`));
    expect(last.knownSourceUrls[0]).toBe('https://shop6.example/drill');
    expect(last.knownSourceUrls.length).toBeLessThanOrEqual(40);
  });
});
