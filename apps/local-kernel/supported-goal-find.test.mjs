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
import { OpportunityProjector, classifyOpportunity, classifySupportedGoalFind } from './opportunity-classifier.mjs';

// Goal -> Evidence -> Kernel SUPPORT -> Find. Live l1-l7 (runs 36410493201, 37126313645) reported
// phase=forged (so evidenceSupportsGoal passed for at least one fetched page) yet
// opportunitiesPromoted=0 and L5/L6 supportedGoalLinkedFinds=0: the lead classifier (score >= 55
// on offer/job/grant-style regexes) silently dropped every SUPPORT-passing page for the Git-docs
// Goal. The offline bench (PR #242) showed the same for the Tesla/bitcoin/OpenAI SUPPORT fixtures.
// SUPPORT itself (packages/kernel/src/evidence/support.ts) is unchanged and still the only gate.
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const capturedAt = '2026-10-03T10:00:00.000Z';
const page = (url, title, visibleText) => ({ schemaVersion: 'hephaestus.page-context.v1', url, canonicalUrl: url, title, visibleText, description: visibleText.slice(0, 500), capturedAt });
const tesla = page('https://example.com/markets/tesla', 'Tesla is listed on NASDAQ', 'Tesla Inc. shares are listed on the NASDAQ stock exchange under the ticker TSLA.');

async function verifierFixture(goalInput, fetched) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-support-find-')), 'store.json'));
  const goal = await new GoalManager(store).create(goalInput);
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  await executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url: fetched.url, title: 'Search result', text: 'UNTRUSTED SNIPPET', summary: 'UNTRUSTED SNIPPET' }] });
  const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), {
    kernel,
    reader: { fetch: async () => ({ ...fetched, fetchedAt: capturedAt, contentType: 'text/html', status: 200 }) },
    now: () => new Date('2026-10-03T10:01:00.000Z'),
  });
  return { store, goal, mission, verifier };
}

describe('classifySupportedGoalFind', () => {
  it('keeps a SUPPORT-passing page the lead classifier ignores, without inventing signals', () => {
    expect(classifyOpportunity(tesla, { evidenceId: 'evidence:t', caseId: 'case:t' })).toEqual({ status: 'ordinary_evidence', score: 0 });
    const result = classifySupportedGoalFind(tesla, { evidenceId: 'evidence:t', caseId: 'case:t' });
    expect(result.status).toBe('opportunity');
    expect(result.opportunity).toMatchObject({
      evidenceId: 'evidence:t', caseId: 'case:t', category: 'goal', categoryLabel: 'Goal match',
      relevance: 0, reasons: [], promotedBy: 'kernel_support', sourceUrl: tesla.url, sourceHost: 'example.com', status: 'new',
    });
  });

  it('uses the Mission scope category and that category’s own signal score', () => {
    const docs = page('https://git-scm.com/doc', 'Git - Documentation', 'Git is a free and open source distributed version control system. Reference manual, installation and license.');
    const result = classifySupportedGoalFind(docs, { evidenceId: 'evidence:g', caseId: 'case:g' }, { scopeCategories: ['tool'] });
    expect(result.opportunity.category).toBe('tool');
    expect(result.opportunity.relevance).toBeGreaterThan(0);
    expect(result.opportunity.relevance).toBeLessThan(55);
    expect(result.opportunity.reasons.length).toBeGreaterThan(0);
  });

  it('leaves classifier-recognised opportunities exactly as before', () => {
    const offer = page('https://shop.example/drill', 'Quality drill 24.99 EUR', 'Limited offer. Discount deal. Oferta limitada. Descuento y promoción. Offer ends on August 12 2026.');
    const refs = { evidenceId: 'evidence:d', caseId: 'case:d' };
    expect(classifySupportedGoalFind(offer, refs, { scopeCategories: ['offer'] })).toEqual(classifyOpportunity(offer, refs));
  });
});

describe('mission verification: Kernel SUPPORT produces the Find', () => {
  it('a forged Mission for a documentation Goal yields a SUPPORT Find instead of zero Finds', async () => {
    const { store, goal, mission, verifier } = await verifierFixture(
      { title: 'Find the official documentation for the Git version control system', categories: ['tool'], keywords: ['Git', 'documentation', 'version control'], priority: 2 },
      { url: 'https://git-scm.com/doc', title: 'Git - Documentation', text: 'Git documentation. Git is a free and open source distributed version control system. Reference manual, book and videos.' },
    );
    const result = await verifier.verify(mission.id);
    expect(result.mission).toMatchObject({ status: 'completed', executionPhase: 'forged', resultSummary: { evidenceCreated: 1, opportunitiesPromoted: 1 } });
    const data = await store.read();
    expect(data.opportunities).toHaveLength(1);
    expect(data.opportunities[0]).toMatchObject({ evidenceId: data.evidence[0].id, category: 'tool', supported: true, supportReason: 'supported', promotedBy: 'kernel_support' });
    const [listed] = await new OpportunityProjector(store).list({ now: '2026-10-03T10:05:00.000Z' });
    expect(listed.goalMatches.map((match) => match.goalId)).toContain(goal.id);
  });

  it('still creates no Find when SUPPORT fails (support.ts gate unchanged)', async () => {
    const { store, mission, verifier } = await verifierFixture(
      { title: 'Find the official documentation for the Git version control system', categories: ['tool'], keywords: ['Git', 'documentation', 'version control'], priority: 2 },
      { url: 'https://jwt.io/introduction', title: 'JSON Web Tokens - jwt.io', text: 'Decode, verify and generate JSON Web Tokens.' },
    );
    const result = await verifier.verify(mission.id);
    // Settled without a Find (never Completado): read, no Kernel SUPPORT.
    expect(result.mission).toMatchObject({ status: 'failed', executionPhase: 'failed', lastFailure: { code: 'verified_without_support' } });
    expect(result.mission.resultSummary.opportunitiesPromoted).toBe(0);
    expect((await store.read()).opportunities ?? []).toHaveLength(0);
  });
});
