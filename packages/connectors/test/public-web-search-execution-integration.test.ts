import { describe, expect, test } from 'vitest';
import { PublicWebSearchClient } from '../src';
import {
  CapabilityRegistry,
  ExecutionEngine,
  GOAL_CONTRACT_VERSION,
  PROPOSED_PLAN_CONTRACT_VERSION,
  PUBLIC_WEB_SEARCH_CAPABILITY,
  PublicWebSearchExecutionAdapter,
} from '../../kernel/src';
import type { ExecutionRecord, ExecutionRecordStore, ProposedPlan, UniversalGoal } from '../../kernel/src';

const now = '2026-08-08T15:00:00.000Z';

function goal(): UniversalGoal {
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:web-search',
    title: 'Find a drill deal',
    desiredOutcome: 'Discover public sources for drills between 18 and 25 EUR',
    successCriteria: ['Public search results returned'],
    constraints: { allowedCapabilities: ['web.search'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.search'],
    forbiddenCapabilities: [],
    allowedDataScopes: ['public_web'],
    forbiddenActions: ['login', 'submit', 'purchase'],
    autonomyLevel: 'assisted',
    approvalConfig: { policy: 'none' },
    notificationConfig: { policy: 'none' },
    memoryConfig: { policy: 'none' },
    terminationConditions: [],
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}

function plan(): ProposedPlan {
  return {
    contractVersion: PROPOSED_PLAN_CONTRACT_VERSION,
    id: 'plan:web-search',
    goalId: 'goal:web-search',
    planSummary: 'Search the public web for bounded candidates',
    planTasks: [],
    requestedCapabilities: [{ capabilityId: 'web.search', version: '1' }],
    expectedEvidence: [],
    approvalCheckpoints: [],
    completionConditions: [],
    status: 'draft',
    revisionNumber: 1,
    previousRevisionId: null,
    revisionId: 'plan:web-search:rev:1',
    contentHash: 'hash',
    createdAt: now,
    updatedAt: now,
    createdRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
    currentRevision: { revision: 1, changedAt: now, changedBy: 'system', diff: {} },
  };
}

function store(): ExecutionRecordStore {
  let records: ExecutionRecord[] = [];
  return {
    transaction: async (callback) => callback(records),
    write: async (next) => { records = next.map((record) => ({ ...record })); },
  };
}

describe('native public web search -> Kernel Execution Engine', () => {
  test('searches only after Goal, plan and capability authorization', async () => {
    const searcher = new PublicWebSearchClient({
      now: () => new Date(now),
      fetchImpl: (async () => new Response(`
        <a class="result__a" href="https://example.com/drill">Quality drill deal</a>
        <div class="result__snippet">24.99 EUR drill with warranty</div>`, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as typeof fetch,
    });
    const registry = new CapabilityRegistry([PUBLIC_WEB_SEARCH_CAPABILITY]);
    const engine = new ExecutionEngine(store(), registry, [new PublicWebSearchExecutionAdapter(searcher)], { now: () => new Date(now) });

    const record = await engine.execute({
      planId: 'plan:web-search',
      revisionId: 'plan:web-search:rev:1',
      capabilityId: 'web.search',
      capabilityVersion: '1',
      idempotencyKey: 'search:drill:18-25',
      payload: { query: 'quality drill 18 25 euro', limit: 5 },
      actor: 'system',
    }, plan(), goal());

    expect(record).toMatchObject({ status: 'completed', capabilityId: 'web.search' });
    expect(record.result).toMatchObject({ query: 'quality drill 18 25 euro', provider: 'duckduckgo-html' });
    expect(record.result?.results).toEqual([expect.objectContaining({ url: 'https://example.com/drill', sourceHost: 'example.com' })]);
  });

  test('fails closed when the Goal does not authorize web.search', async () => {
    const searcher = new PublicWebSearchClient({ fetchImpl: (async () => new Response('', { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch });
    const registry = new CapabilityRegistry([PUBLIC_WEB_SEARCH_CAPABILITY]);
    const engine = new ExecutionEngine(store(), registry, [new PublicWebSearchExecutionAdapter(searcher)]);
    const deniedGoal = { ...goal(), allowedCapabilities: ['web.read'], constraints: { allowedCapabilities: ['web.read'], allowedDataScopes: ['public_web'] } };

    await expect(engine.execute({
      planId: 'plan:web-search', revisionId: 'plan:web-search:rev:1', capabilityId: 'web.search', capabilityVersion: '1',
      idempotencyKey: 'search:denied', payload: { query: 'quality drill' }, actor: 'system',
    }, plan(), deniedGoal)).rejects.toThrow();
  });
});
