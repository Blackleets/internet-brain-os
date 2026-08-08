import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PublicWebSearchClient, WebPageFetcher } from '../../packages/connectors/src/index.ts';
import {
  CapabilityRegistry,
  CaseManager,
  EvidenceManager,
  ExecutionEngine,
  GOAL_CONTRACT_VERSION,
  InMemoryCaseRepository,
  InMemoryEvidenceRepository,
  NotificationGateway,
  PROPOSED_PLAN_CONTRACT_VERSION,
  PUBLIC_WEB_READ_CAPABILITY,
  PUBLIC_WEB_SEARCH_CAPABILITY,
  PublicWebReadExecutionAdapter,
  PublicWebSearchExecutionAdapter,
  TriggerEngine,
} from '../../packages/kernel/src/index.ts';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const t0 = '2026-08-08T15:00:00.000Z';
const t1 = '2026-08-08T15:01:00.000Z';
const t2 = '2026-08-08T15:02:00.000Z';

function goal() {
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:drill-18-25',
    title: 'Find a quality drill between 18 and 25 EUR',
    desiredOutcome: 'Find a public product candidate in budget and notify the user',
    successCriteria: ['Candidate price is within 18-25 EUR', 'Evidence is retained', 'User is notified'],
    constraints: { allowedCapabilities: ['web.search', 'web.read'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.search', 'web.read'], forbiddenCapabilities: [], allowedDataScopes: ['public_web'],
    forbiddenActions: ['login', 'submit', 'purchase'], autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' }, notificationConfig: { policy: 'none' }, memoryConfig: { policy: 'none' },
    terminationConditions: [], status: 'active', createdAt: t0, updatedAt: t0,
    createdRevision: { revision: 1, changedAt: t0, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: t0, changedBy: 'system', diff: {} },
  };
}

function plan() {
  return {
    contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
    id: 'plan:drill', goalId: 'goal:drill-18-25', planSummary: 'Search, inspect and surface a bounded candidate', planTasks: [],
    requestedCapabilities: [{ capabilityId: 'web.search', version: '1' }, { capabilityId: 'web.read', version: '1' }],
    expectedEvidence: [{ key: 'product-page', description: 'Public product page with price' }], approvalCheckpoints: [], completionConditions: [],
    status: 'draft', revisionNumber: 1, previousRevisionId: null, revisionId: 'plan:drill:rev:1', contentHash: 'golden-hash',
    createdAt: t0, updatedAt: t0,
    createdRevision: { revision: 1, changedAt: t0, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: t0, changedBy: 'system', diff: {} },
  };
}

function executionStore() {
  let records = [];
  return { transaction: async (callback) => callback(records), write: async (next) => { records = structuredClone(next); } };
}
function triggerStore() {
  let events = [];
  return { transaction: async (callback) => callback(events), write: async (next) => { events = structuredClone(next); } };
}
function notificationStore() {
  let receipts = [];
  return { transaction: async (callback) => callback(receipts), write: async (next) => { receipts = structuredClone(next); } };
}

describe('Golden Goal: quality drill between 18 and 25 EUR', () => {
  test('Goal -> search -> read -> Evidence -> Opportunity ranking -> Trigger -> Notification', async () => {
    const searcher = new PublicWebSearchClient({
      now: () => new Date(t1),
      fetchImpl: async () => new Response(`
        <a class="result__a" href="https://shop.example.com/drill-24">Quality cordless drill 24.99 EUR</a>
        <div class="result__snippet">Limited offer. Quality cordless drill with warranty for 24.99 EUR.</div>`,
      { status: 200, headers: { 'content-type': 'text/html' } }),
    });
    const reader = new WebPageFetcher({
      lookupImpl: async () => [{ address: '93.184.216.34', family: 4 }],
      requestImpl: async () => new Response(`<html><title>Quality cordless drill 24.99 EUR</title><body>Limited offer. Discount deal. Quality cordless drill with warranty for 24.99 EUR. Offer expires August 12, 2026.</body></html>`, {
        status: 200, headers: { 'content-type': 'text/html' },
      }),
    });
    const registry = new CapabilityRegistry([PUBLIC_WEB_SEARCH_CAPABILITY, PUBLIC_WEB_READ_CAPABILITY]);
    const executions = new ExecutionEngine(executionStore(), registry, [
      new PublicWebSearchExecutionAdapter(searcher), new PublicWebReadExecutionAdapter(reader),
    ], { now: () => new Date(t1) });

    const search = await executions.execute({
      planId: plan().id, revisionId: plan().revisionId, capabilityId: 'web.search', capabilityVersion: '1',
      idempotencyKey: 'golden:search:drill', payload: { query: 'quality drill 18 25 euro', limit: 5 }, actor: 'system',
    }, plan(), goal());
    const candidate = search.result.results[0];
    expect(candidate.url).toBe('https://shop.example.com/drill-24');

    const read = await executions.execute({
      planId: plan().id, revisionId: plan().revisionId, capabilityId: 'web.read', capabilityVersion: '1',
      idempotencyKey: `golden:read:${candidate.url}`, payload: { url: candidate.url }, actor: 'system',
    }, plan(), goal());
    expect(read.result.text).toContain('24.99 EUR');

    const caseRepository = new InMemoryCaseRepository();
    const caseManager = new CaseManager(caseRepository);
    const evidenceManager = new EvidenceManager(new InMemoryEvidenceRepository(), caseRepository);
    await caseManager.create({ id: 'case:golden-drill', title: 'Drill research', objective: goal().desiredOutcome, createdAt: t1 });
    const evidence = await evidenceManager.create({
      id: 'evidence:golden-drill', caseId: 'case:golden-drill', sourceUrl: read.result.sourceUrl,
      contentType: 'webpage', rawText: read.result.text, capturedAt: t1, extractionMethod: 'web.read', confidence: 0.9,
      tags: ['golden', 'offer', 'drill'],
    });
    expect(evidence.sourceUrl).toBe('https://shop.example.com/drill-24');

    const directory = await mkdtemp(join(tmpdir(), 'efesto-golden-drill-'));
    const localStore = new LocalKnowledgeStore(join(directory, 'store.json'));
    await localStore.project(async (data) => ({
      changed: true,
      data: { ...data, goals: [{ id: goal().id, title: goal().title, categories: ['offer'], keywords: ['drill', '24.99'], priority: 3, status: 'active', createdAt: t0 }] },
    }));
    const opportunities = new OpportunityProjector(localStore);
    const projected = await opportunities.project({
      schemaVersion: 'hephaestus.page-context.v1', url: candidate.url, canonicalUrl: candidate.url,
      title: read.result.title, visibleText: read.result.text, capturedAt: t1,
    }, { caseId: 'case:golden-drill', evidenceId: evidence.id });
    expect(projected.status).toBe('opportunity');
    const [ranked] = await opportunities.list();
    expect(ranked.goalMatches[0].goalId).toBe(goal().id);
    expect(ranked.ranking.components.evidenceStrength).toBe(99);
    expect(ranked.ranking.reasons).toContain('Case and Evidence provenance available');

    const triggers = new TriggerEngine([{
      id: 'trigger:golden-drill', goalId: goal().id, planId: plan().id, revisionId: plan().revisionId,
      condition: { type: 'new_match', field: 'matches' }, enabled: true, createdAt: t0,
    }], triggerStore());
    const triggerEvent = await triggers.evaluate('trigger:golden-drill', {
      observedAt: t2, sourceKey: ranked.id, values: { matches: [ranked.id] },
    });
    expect(triggerEvent).not.toBeNull();

    const notifications = new NotificationGateway(notificationStore());
    const notification = await notifications.queue({
      dedupeKey: triggerEvent.eventKey, sourceType: 'trigger', sourceId: triggerEvent.id, goalId: goal().id,
      evidenceIds: [evidence.id], title: 'Taladro encontrado dentro del presupuesto',
      body: `${ranked.title} — 24.99 EUR. Efesto conservó la Evidence y no realizó ninguna compra.`,
      priority: 'high', actionRequired: true, createdAt: t2,
    });
    expect(notification.state).toBe('queued');
    expect(notification.evidenceIds).toEqual([evidence.id]);
    expect(notification.body).toContain('no realizó ninguna compra');

    const replay = await notifications.queue({
      dedupeKey: triggerEvent.eventKey, sourceType: 'trigger', sourceId: triggerEvent.id, goalId: goal().id,
      evidenceIds: [evidence.id], title: 'Taladro encontrado dentro del presupuesto',
      body: `${ranked.title} — 24.99 EUR. Efesto conservó la Evidence y no realizó ninguna compra.`,
      priority: 'high', actionRequired: true, createdAt: t2,
    });
    expect(replay).toEqual(notification);
    expect(await notifications.list()).toHaveLength(1);
  });
});
