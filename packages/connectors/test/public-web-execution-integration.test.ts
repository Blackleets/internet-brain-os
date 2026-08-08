import { describe, expect, test } from 'vitest';
import { WebPageFetcher } from '../src';
import {
  CapabilityRegistry,
  ExecutionEngine,
  GOAL_CONTRACT_VERSION,
  PROPOSED_PLAN_CONTRACT_VERSION,
  PUBLIC_WEB_READ_CAPABILITY,
  PublicWebReadExecutionAdapter,
} from '../../kernel/src';
import type { ExecutionRecord, ExecutionRecordStore, ProposedPlan, UniversalGoal } from '../../kernel/src';

const now = '2026-08-08T14:00:00.000Z';

function goal(): UniversalGoal {
  return {
    contractVersion: GOAL_CONTRACT_VERSION,
    id: 'goal:web-read',
    title: 'Read a public product page',
    desiredOutcome: 'Capture auditable public source text',
    successCriteria: ['Public page returned'],
    constraints: { allowedCapabilities: ['web.read'], allowedDataScopes: ['public_web'] },
    allowedCapabilities: ['web.read'],
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
    id: 'plan:web-read',
    goalId: 'goal:web-read',
    planSummary: 'Read one public page',
    planTasks: [],
    requestedCapabilities: [{ capabilityId: 'web.read', version: '1' }],
    expectedEvidence: [],
    approvalCheckpoints: [],
    completionConditions: [],
    status: 'draft',
    revisionNumber: 1,
    previousRevisionId: null,
    revisionId: 'plan:web-read:rev:1',
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

describe('public web connector -> Kernel Execution Engine', () => {
  test('reads a public page only after capability and plan authorization', async () => {
    const fetcher = new WebPageFetcher({
      lookupImpl: (async () => [{ address: '93.184.216.34', family: 4 }]) as never,
      requestImpl: async (url) => new Response('<html><title>Drill deal</title><body>Quality drill for 24.99 EUR</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    });
    const registry = new CapabilityRegistry([PUBLIC_WEB_READ_CAPABILITY]);
    const engine = new ExecutionEngine(store(), registry, [new PublicWebReadExecutionAdapter(fetcher)], { now: () => new Date(now) });

    const record = await engine.execute({
      planId: 'plan:web-read',
      revisionId: 'plan:web-read:rev:1',
      capabilityId: 'web.read',
      capabilityVersion: '1',
      idempotencyKey: 'read:https://example.com/drill',
      payload: { url: 'https://example.com/drill' },
      actor: 'system',
    }, plan(), goal());

    expect(record).toMatchObject({ status: 'completed', capabilityId: 'web.read' });
    expect(record.result).toMatchObject({ title: 'Drill deal', status: 200 });
    expect(String(record.result?.text)).toContain('24.99 EUR');
  });
});
