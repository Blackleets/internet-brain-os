import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as kernel from '../../packages/kernel/src/index.ts';
import { NotificationGateway } from '../../packages/kernel/src/index.ts';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { MissionSearchCandidateVerifier } from './mission-search-candidate-verifier.mjs';
import { memoryNotificationReceiptStore } from './notification-receipt-store.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';
import { queueSupportedFindNotifications } from './supported-find-notifier.mjs';

const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };

function gateway() {
  return new NotificationGateway(memoryNotificationReceiptStore());
}

function verifiedPage() {
  return {
    url: 'https://shop.example/drill',
    title: 'Quality drill 24.99 EUR',
    text: 'Limited offer. Discount deal. Oferta limitada. Descuento y promoción. Quality cordless drill with warranty for 24.99 EUR. Offer ends on August 12 2026.',
    fetchedAt: '2026-08-09T22:19:00.000Z',
    contentType: 'text/html',
    status: 200,
  };
}

async function verifyingFixture({
  reader,
  goalInput = { title: 'Find a drill offer', categories: ['offer'], keywords: ['drill'] },
  findings = [{ url: 'https://shop.example/drill', title: 'Search result drill', text: 'UNTRUSTED SEARCH SNIPPET', summary: 'UNTRUSTED SEARCH SNIPPET' }],
  notifications = gateway(),
} = {}) {
  const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-find-notify-')), 'store.json'));
  const goal = await new GoalManager(store).create(goalInput);
  const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
  const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
  const claim = await executor.claim('hermes', mission.id);
  await executor.complete(mission.id, {
    leaseId: claim.leaseId,
    resultKind: 'search_candidates',
    findings,
  });
  const verifier = new MissionSearchCandidateVerifier(store, new OpportunityProjector(store), {
    kernel,
    reader,
    notificationGateway: notifications,
    now: () => new Date('2026-08-09T22:20:00.000Z'),
  });
  return { store, mission, verifier, notifications };
}

describe('queueSupportedFindNotifications', () => {
  it('queues only Kernel SUPPORT Finds and skips Evidence-only unsupported leads', async () => {
    const notifications = gateway();
    const mission = {
      id: 'mission:1',
      goalId: 'goal:1',
      verificationResults: [
        { candidateId: 'c1', evidenceId: 'evidence:supported', supported: true, status: 'verified' },
        { candidateId: 'c2', evidenceId: 'evidence:only', supported: false, status: 'verified' },
      ],
    };
    const opportunities = [
      {
        id: 'opportunity:supported',
        title: 'Quality drill 24.99 EUR',
        evidenceId: 'evidence:supported',
        sourceUrl: 'https://shop.example/drill',
        supported: true,
        status: 'new',
      },
      {
        id: 'opportunity:evidence-only',
        title: 'Random page',
        evidenceId: 'evidence:only',
        sourceUrl: 'https://jwt.io/',
        status: 'new',
      },
    ];
    const queued = await queueSupportedFindNotifications({
      gateway: notifications,
      mission,
      opportunities,
      createdAt: '2026-08-09T22:20:00.000Z',
    });
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({
      sourceType: 'opportunity',
      sourceId: 'opportunity:supported',
      goalId: 'goal:1',
      evidenceIds: ['evidence:supported'],
      state: 'unread',
    });
    expect(await notifications.list()).toHaveLength(1);
  });

  it('does not notify when verificationResults lack supported === true', async () => {
    const notifications = gateway();
    const queued = await queueSupportedFindNotifications({
      gateway: notifications,
      mission: {
        id: 'mission:1',
        goalId: 'goal:1',
        verificationResults: [{ candidateId: 'c1', evidenceId: 'evidence:1', supported: false }],
      },
      opportunities: [{
        id: 'opportunity:1',
        title: 'Lead',
        evidenceId: 'evidence:1',
        sourceUrl: 'https://shop.example/x',
        status: 'new',
      }],
      createdAt: '2026-08-09T22:20:00.000Z',
    });
    expect(queued).toEqual([]);
    expect(await notifications.list()).toHaveLength(0);
  });
});

describe('MissionSearchCandidateVerifier NotificationGateway wire', () => {
  it('queues a notification when a SUPPORT Find is forged', async () => {
    const { verifier, notifications, mission } = await verifyingFixture({
      reader: { fetch: async () => verifiedPage() },
    });
    const result = await verifier.verify(mission.id);
    expect(result.mission).toMatchObject({ status: 'completed', executionPhase: 'forged' });
    const listed = await notifications.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      sourceType: 'opportunity',
      state: 'unread',
      priority: 'high',
      actionRequired: true,
    });
    expect(listed[0].evidenceIds?.[0]).toMatch(/^evidence:verified:/);
    expect(listed[0].body).toContain('Kernel SUPPORT');

    const replay = await verifier.verify(mission.id);
    expect(replay.idempotent).toBe(true);
    expect(await notifications.list()).toHaveLength(1);
  });

  it('does not notify for Evidence-only unsupported pages', async () => {
    const { verifier, notifications, mission } = await verifyingFixture({
      reader: {
        fetch: async () => ({
          url: 'https://jwt.io/',
          title: 'JSON Web Tokens - jwt.io',
          text: 'Decode, verify and generate JSON Web Tokens. AWS Cognito JWT docs. noindex documentation.',
          fetchedAt: '2026-08-09T22:19:00.000Z',
          contentType: 'text/html',
          status: 200,
        }),
      },
      goalInput: {
        title: 'Locate record xyz-nonexist-token-9f3a in public filings',
        categories: ['offer'],
        keywords: ['xyz-nonexist-token-9f3a'],
      },
      findings: [{
        url: 'https://jwt.io/',
        title: 'Search result',
        text: 'UNTRUSTED SEARCH SNIPPET',
        summary: 'UNTRUSTED SEARCH SNIPPET',
      }],
    });
    const result = await verifier.verify(mission.id);
    expect(result.mission.status).not.toBe('completed');
    expect(result.mission.executionPhase).toBe('verifying');
    expect(await notifications.list()).toHaveLength(0);
  });
});
