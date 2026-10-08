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
import { currentGoalRevision } from './goal-execution-authorization.mjs';

// TEST FIXTURES: Kernel-shaped pages and agent results (not product data).
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const page = (url, price) => ({
  url,
  title: `Quality cordless drill ${price} EUR`,
  text: `Limited offer. Discount deal. Oferta limitada. Descuento y promocion. Quality cordless drill with warranty for ${price} EUR. Offer ends on August 12 2026.`,
  fetchedAt: '2026-08-09T22:19:00.000Z', contentType: 'text/html', status: 200,
});
const searchMore = { agent: 'hermes', confirmed: true, mode: 'search_more' };
const edit = (fields) => ({ confirmed: true, ...fields });

async function fixture() {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-goal-revision-')), 'store.json'));
  const goals = new GoalManager(store);
  const goal = await goals.create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
  const missions = new AgentMissionManager(store, { isAgentReady: () => true });
  const mission = await missions.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const submit = async (url) => {
    const claim = await executor.claim('hermes', mission.id);
    await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url, title: 'Search result', text: 'UNTRUSTED SEARCH SNIPPET' }] });
    return claim;
  };
  const verify = (url, price) => new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), { kernel, reader: { fetch: async () => page(url, price) }, now: () => new Date('2026-08-09T22:20:00.000Z') }).verify(mission.id);
  const attempt = async (url, price) => { await submit(url); return verify(url, price); };
  return { store, goals, goal, missions, mission, executor, submit, verify, attempt };
}

describe('Goal revision ("Editar Goal")', () => {
  it('keeps the Goal id and Mission id, bumps the revision, and keeps earlier attempts, Evidence and Finds', async () => {
    const { store, goals, goal, missions, mission, attempt } = await fixture();
    expect((await attempt('https://shop.example/drill', '24.99')).mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    const before = await store.read();
    expect(before.evidence).toHaveLength(1);
    expect(before.opportunities).toHaveLength(1);

    const revised = await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer', keywords: ['drill', 'cordless'], location: 'Madrid', expectedRevision: 1 }), interactive);
    expect(revised).toMatchObject({ changed: true, revision: 2 });
    expect(revised.changedFields).toEqual(expect.arrayContaining(['title', 'keywords', 'location']));
    expect(revised.goal).toMatchObject({
      id: goal.id, title: 'Find a cordless drill offer', location: 'Madrid', revision: 2,
      revisedBy: 'dashboard-ui', idBasis: 'created_content', createdAt: goal.createdAt, priority: goal.priority, status: 'active',
    });
    expect(revised.goal.keywords).toEqual(expect.arrayContaining(['drill', 'cordless']));
    expect(revised.goal.revisions).toEqual([expect.objectContaining({ revision: 1, title: 'Find a drill offer', keywords: goal.keywords, categories: goal.categories, supersededBy: 'dashboard-ui' })]);
    expect(currentGoalRevision(revised.goal)).toBe(2);

    // Nothing else moved: same single Goal, the finished Mission, its Evidence and Find are untouched.
    const after = await store.read();
    expect(after.goals).toHaveLength(1);
    expect(after.evidence).toEqual(before.evidence);
    expect(after.opportunities).toEqual(before.opportunities);
    expect(after.agentMissions).toEqual(before.agentMissions);
    expect((await goals.list()).map((item) => item.id)).toEqual([goal.id]);

    // "Buscar más" after the edit: same Mission id, the new text, a receipt for revision 2, the earlier attempt kept.
    const queued = await missions.create(goal.id, searchMore, interactive);
    expect(queued).toMatchObject({ id: mission.id, goalId: goal.id, goalTitle: 'Find a cordless drill offer', status: 'queued', searchMode: 'search_more' });
    expect(queued.scope).toMatchObject({ location: 'Madrid' });
    expect(queued.scope.keywords).toEqual(expect.arrayContaining(['cordless']));
    expect(queued.authorization).toMatchObject({ goalId: goal.id, goalRevision: 2, decidedBy: 'dashboard-ui' });
    expect(queued.priorAttempts).toHaveLength(1);
    expect(queued.priorAttempts[0].verificationResults[0]).toMatchObject({ supported: true, sourceUrl: 'https://shop.example/drill' });

    // The revision-2 receipt passes the claim gate and the Kernel verifier: the new attempt adds a second Find.
    const second = await attempt('https://shop.example/cordless-drill', '39.99');
    expect(second.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    const final = await store.read();
    expect(final.evidence).toHaveLength(2);
    expect(final.opportunities).toHaveLength(2);
    expect(final.evidence[0]).toEqual(before.evidence[0]);
    const evidence = await new MissionEvidenceReader(store).list(mission.id);
    expect(evidence.evidence).toHaveLength(2);
    expect(evidence.evidence.filter((record) => record.priorAttempt)).toHaveLength(1);
  });

  it('candidates awaiting Kernel verification (no lease) block the edit (409) so the attempt is not stranded as blocked; the verifier still refuses a revision mismatch', async () => {
    const { store, goals, goal, missions, submit, verify } = await fixture();
    await submit('https://shop.example/drill');
    const pending = (await store.read()).agentMissions[0];
    expect(pending).toMatchObject({ status: 'running', executionPhase: 'verifying' });
    expect(pending.leaseExpiresAt).toBeUndefined();

    // Before: the lease-only gate let this edit through; the verifier then denied
    // authorization_revision_mismatch and left the Mission running/verifying with a
    // verificationBlock forever (no lease to expire, not stranded-settleable, no Buscar más).
    const beforeEdit = await store.read();
    await expect(goals.revise(goal.id, edit({ title: 'Find a cordless drill offer' }), interactive)).rejects.toMatchObject({ code: 'GOAL_MISSION_RUNNING', status: 409 });
    expect(await store.read()).toEqual(beforeEdit);

    // The pending verification settles against the revision it was authorized for; then the edit is accepted.
    const settled = await verify('https://shop.example/drill', '24.99');
    expect(settled.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    expect(await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer' }), interactive)).toMatchObject({ changed: true, revision: 2 });
    expect((await missions.list())[0]).not.toHaveProperty('verificationBlock');
  });

  it('a verification already blocked by Kernel policy does not freeze Goal edits; a raw revision mismatch is still never verified', async () => {
    const { store, goals, goal, submit, verify } = await fixture();
    await submit('https://shop.example/drill');
    // TEST FIXTURE: the Goal revision moves underneath the pending batch (pre-fix persisted state).
    await store.project(async (data) => ({ changed: true, data: { ...data, goals: data.goals.map((item) => ({ ...item, revision: 2 })) }, result: null }));
    const outcome = await verify('https://shop.example/drill', '24.99');
    const data = await store.read();
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
    expect(outcome.mission.limitation).toBe('Kernel web.read verification blocked: authorization_revision_mismatch');
    expect(outcome.mission.resultSummary).toMatchObject({ received: 1, evidenceCreated: 0, opportunitiesPromoted: 0 });
    // The block is already recorded (verification will not run again), so the edit is not refused.
    expect(await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer', expectedRevision: 2 }), interactive)).toMatchObject({ changed: true, revision: 3 });
  });

  it('all unsupported candidates can settle without freezing editing, but a partial batch still protects its revision', async () => {
    const { store, goals, goal, submit, missions, mission } = await fixture();
    await submit('https://shop.example/drill');
    await store.project(async (data) => ({ changed: true, data: { ...data, agentMissions: data.agentMissions.map((item) => ({
      ...item, searchCandidates: [...item.searchCandidates, { ...item.searchCandidates[0], id: 'candidate:second', url: 'https://shop.example/other' }],
      verificationResults: [{ candidateId: item.searchCandidates[0].id, status: 'verified', supported: false }],
    })) }, result: null }));
    const pending = await store.read();
    await expect(goals.revise(goal.id, edit({ title: 'Find a cordless drill offer' }), interactive)).rejects.toMatchObject({ code: 'GOAL_MISSION_RUNNING', status: 409 });
    expect(await store.read()).toEqual(pending);
    await store.project(async (data) => ({ changed: true, data: { ...data, agentMissions: data.agentMissions.map((item) => ({
      ...item, verificationResults: [...item.verificationResults, { candidateId: 'candidate:second', status: 'verification_failed' }],
    })) }, result: null }));
    expect(await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer' }), interactive)).toMatchObject({ revision: 2 });
    expect((await missions.list()).find((item) => item.id === mission.id)).toMatchObject({ status: 'failed', executionPhase: 'failed' });
  });

  it('refuses without the interactive confirmation (403) and without confirmed:true (400), changing nothing', async () => {
    const { store, goals, goal } = await fixture();
    const before = await store.read();
    await expect(goals.revise(goal.id, edit({ title: 'Other text' }), {})).rejects.toMatchObject({ code: 'GOAL_REVISION_CONFIRMATION_REQUIRED', status: 403 });
    await expect(goals.revise(goal.id, edit({ title: 'Other text' }))).rejects.toMatchObject({ status: 403 });
    await expect(goals.revise(goal.id, { title: 'Other text' }, interactive)).rejects.toMatchObject({ code: 'INVALID_GOAL', status: 400 });
    await expect(goals.revise(goal.id, edit({ title: 'x' }), interactive)).rejects.toMatchObject({ code: 'INVALID_GOAL', status: 400 });
    expect(await store.read()).toEqual(before);
  });

  it('404 for an unknown Goal, 409 on a stale expectedRevision, 409 for a Universal (v2) Goal', async () => {
    const { store, goals, goal } = await fixture();
    await expect(goals.revise('goal:missing', edit({ title: 'Other text' }), interactive)).rejects.toMatchObject({ code: 'GOAL_NOT_FOUND', status: 404 });
    await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer', expectedRevision: 1 }), interactive);
    await expect(goals.revise(goal.id, edit({ title: 'Find a hammer drill offer', expectedRevision: 1 }), interactive)).rejects.toMatchObject({ code: 'GOAL_REVISION_CONFLICT', status: 409 });
    expect((await store.read()).goals[0]).toMatchObject({ title: 'Find a cordless drill offer', revision: 2 });
    await store.project(async (data) => ({ changed: true, data: { ...data, goals: [...data.goals, { id: 'goal:v2', contractVersion: 2, title: 'Universal', status: 'active', currentRevision: { revision: 1 } }] }, result: null }));
    await expect(goals.revise('goal:v2', edit({ title: 'Universal edited' }), interactive)).rejects.toMatchObject({ code: 'GOAL_REVISION_UNSUPPORTED', status: 409 });
  });

  it('a Mission with a live Hermes lease blocks the edit (409); a queued Mission follows the new text with a revision-2 receipt', async () => {
    const { store, goals, goal, missions, mission, executor } = await fixture();
    const queuedBefore = (await store.read()).agentMissions[0];
    expect(queuedBefore).toMatchObject({ status: 'queued', authorization: { goalRevision: 1 } });
    const revised = await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer', keywords: ['cordless'] }), interactive);
    const requeued = (await store.read()).agentMissions[0];
    expect(requeued).toMatchObject({ id: mission.id, status: 'queued', goalTitle: 'Find a cordless drill offer', authorization: { goalId: goal.id, goalRevision: 2, decidedBy: 'dashboard-ui' } });
    expect(requeued.scope.keywords).toEqual(revised.goal.keywords);

    await executor.claim('hermes', mission.id);
    const leased = await store.read();
    expect(leased.agentMissions[0].status).toBe('running');
    await expect(goals.revise(goal.id, edit({ title: 'Find a hammer drill offer' }), interactive)).rejects.toMatchObject({ code: 'GOAL_MISSION_RUNNING', status: 409 });
    expect(await store.read()).toEqual(leased);
    expect((await missions.list())[0].id).toBe(mission.id);
  });

  it('an unchanged edit is a no-op (no revision bump); location can be cleared with null', async () => {
    const { goals, goal } = await fixture();
    const same = await goals.revise(goal.id, edit({ title: '  Find a   drill offer ', keywords: ['drill'], categories: ['offer'] }), interactive);
    expect(same).toMatchObject({ changed: false, revision: 1 });
    expect(same.goal).toEqual(goal);
    const located = await goals.revise(goal.id, edit({ location: 'Madrid' }), interactive);
    expect(located).toMatchObject({ changed: true, revision: 2, changedFields: ['location'] });
    const cleared = await goals.revise(goal.id, edit({ location: null }), interactive);
    expect(cleared).toMatchObject({ changed: true, revision: 3, changedFields: ['location'] });
    expect(cleared.goal).not.toHaveProperty('location');
    expect(cleared.goal.revisions.map((item) => item.revision)).toEqual([1, 2]);
  });

  it('the id is a historical identity: creating the original text again returns the revised Goal, not a duplicate', async () => {
    const { store, goals, goal } = await fixture();
    await goals.revise(goal.id, edit({ title: 'Find a cordless drill offer' }), interactive);
    const again = await goals.create({ title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] });
    expect(again).toMatchObject({ id: goal.id, title: 'Find a cordless drill offer', revision: 2 });
    expect((await store.read()).goals).toHaveLength(1);
  });

  it('legacy revision is validated where authorization reads it', () => {
    expect(currentGoalRevision({ id: 'goal:a' })).toBe(1);
    expect(currentGoalRevision({ id: 'goal:a', revision: 4 })).toBe(4);
    expect(() => currentGoalRevision({ id: 'goal:a', revision: 0 })).toThrow();
    expect(() => currentGoalRevision({ id: 'goal:a', revision: 1.5 })).toThrow();
  });
});
