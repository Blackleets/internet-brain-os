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

const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };
const capturedAt = '2026-10-05T00:20:00.000Z';
const url = 'https://example.com/madrid-delivery-role';
const title = 'Trabajo delivery en Madrid';
// Deliberately stronger "client" heuristic signals than "job" signals, while still containing
// the Goal terms that Kernel SUPPORT evaluates on the fetched page.
const text = [
  'Empleo delivery Madrid.',
  'Looking for consultant freelancer and seeking a provider for a paid contract project.',
  'Buscamos proveedor autónomo consultor. Necesitamos presupuesto para proyecto pagado.',
].join(' ');
const page = {
  schemaVersion: 'hephaestus.page-context.v1',
  url,
  canonicalUrl: url,
  title,
  visibleText: text,
  description: text,
  capturedAt,
};

describe('Kernel SUPPORT vs heuristic category conflict', () => {
  it('keeps the Find in the confirmed Goal scope when the generic classifier chooses another category', () => {
    const refs = { evidenceId: 'evidence:conflict', caseId: 'case:conflict' };
    const generic = classifyOpportunity(page, refs);
    expect(generic.status).toBe('opportunity');
    expect(generic.opportunity.category).toBe('client');

    const supported = classifySupportedGoalFind(page, refs, { scopeCategories: ['job'] });
    expect(supported.status).toBe('opportunity');
    expect(supported.opportunity).toMatchObject({
      category: 'job',
      categoryLabel: 'Job',
      promotedBy: 'kernel_support',
      sourceUrl: url,
      evidenceId: 'evidence:conflict',
    });
    expect(supported.opportunity.reasons.length).toBeGreaterThan(0);
  });

  it('end-to-end verification for a SUPPORT-passing job page forges one job Find instead of discarding it', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-support-category-')), 'store.json'));
    const goal = await new GoalManager(store).create({
      title: 'Encuentra empleo delivery en Madrid',
      categories: ['job'],
      keywords: ['empleo', 'delivery', 'Madrid'],
      priority: 2,
    });
    const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(
      goal.id,
      { agent: 'hermes', confirmed: true },
      interactive,
    );
    const projector = new OpportunityProjector(store);
    const executor = new AgentMissionExecutor(store, projector, { automaticClaims: false });
    const claim = await executor.claim('hermes', mission.id);
    await executor.complete(mission.id, {
      leaseId: claim.leaseId,
      resultKind: 'search_candidates',
      findings: [{ url, title: 'Search result', text: 'UNTRUSTED SNIPPET', summary: 'UNTRUSTED SNIPPET' }],
    });

    const verifier = new MissionSearchCandidateVerifier(store, projector, {
      kernel,
      reader: { fetch: async () => ({ url, sourceUrl: url, title, text, fetchedAt: capturedAt, contentType: 'text/html', status: 200 }) },
      now: () => new Date('2026-10-05T00:21:00.000Z'),
    });
    const result = await verifier.verify(mission.id);

    expect(result.mission).toMatchObject({
      status: 'completed',
      executionPhase: 'forged',
      resultSummary: { evidenceCreated: 1, opportunitiesPromoted: 1 },
    });
    const data = await store.read();
    expect(data.opportunities).toHaveLength(1);
    expect(data.opportunities[0]).toMatchObject({
      category: 'job',
      supported: true,
      supportReason: 'supported',
      promotedBy: 'kernel_support',
      sourceUrl: url,
    });
  });
});
