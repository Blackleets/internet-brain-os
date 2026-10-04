import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { settleStrandedVerification, isSettledVerification, VERIFIED_WITHOUT_SUPPORT, WEB_READ_FAILED } from './mission-verification-settlement.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const now = new Date('2026-10-04T12:00:00.000Z');
const interactive = { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } };

/** The shape the old verifier left behind (run 6): running/verifying, no lease, every candidate read, none supported. */
function stranded(overrides = {}) {
  return {
    id: 'mission:stranded', goalId: 'goal:1', goalTitle: 'empleo de rider o delivery en España', agent: 'hermes', cadence: 'manual',
    status: 'running', executionPhase: 'verifying', attempt: 3, createdAt: '2026-10-04T10:01:31.570Z', verifyingAt: '2026-10-04T10:39:47.680Z',
    searchCandidates: [{ id: 'c1', url: 'https://a.example/', status: 'verified' }, { id: 'c2', url: 'https://b.example/', status: 'verification_failed' }],
    verificationResults: [
      { candidateId: 'c1', status: 'verified', evidenceId: 'evidence:1', supported: false, supportReason: 'goal_tokens_absent' },
      { candidateId: 'c2', status: 'verification_failed', reason: 'web.read returned HTTP 403' },
    ],
    limitation: 'Kernel web.read retrieved page content as Evidence; none of the pages support the Goal, so investigation remains incomplete',
    ...overrides,
  };
}

describe('stranded verifications settle explicitly', () => {
  it('read without SUPPORT → failed/failed verified_without_support, never completed', () => {
    const next = settleStrandedVerification(stranded(), now);
    expect(next).toMatchObject({
      status: 'failed', executionPhase: 'failed', failedAt: now.toISOString(),
      lastFailure: { code: VERIFIED_WITHOUT_SUPPORT, attempt: 3, recordedAt: now.toISOString() },
    });
    expect(next.lastFailure.reason).toBe('Kernel web.read read 1 page; none supports the Goal (no Kernel SUPPORT, no Find)');
    expect(next.completedAt).toBeUndefined();
    expect(next.forgedAt).toBeUndefined();
    // Evidence links and verdicts are kept as they were.
    expect(next.verificationResults).toEqual(stranded().verificationResults);
  });

  it('every read failed → failed/failed web_read_failed', () => {
    const next = settleStrandedVerification(stranded({
      verificationResults: [
        { candidateId: 'c1', status: 'verification_failed', reason: 'network' },
        { candidateId: 'c2', status: 'verification_failed', reason: 'network' },
      ],
    }), now);
    expect(next).toMatchObject({ status: 'failed', executionPhase: 'failed', lastFailure: { code: WEB_READ_FAILED, reason: 'Kernel web.read could not read any candidate page' } });
  });

  it('leaves alone: verification not run yet, partial results, a supported row, a policy block, a live lease, other states', () => {
    for (const mission of [
      stranded({ verificationResults: undefined }),
      stranded({ verificationResults: [] }),
      stranded({ verificationResults: [stranded().verificationResults[0]] }),
      stranded({ verificationResults: [{ ...stranded().verificationResults[0], supported: true }, stranded().verificationResults[1]] }),
      stranded({ verificationBlock: { reason: 'goal_not_active' } }),
      stranded({ leaseExpiresAt: '2026-10-04T12:05:00.000Z', leaseId: 'lease' }),
      stranded({ status: 'completed', executionPhase: 'forged' }),
      stranded({ status: 'running', executionPhase: 'investigating' }),
    ]) {
      expect(settleStrandedVerification(mission, now)).toBe(mission);
    }
  });

  it('only a sealed digest counts as a settled verification (replays are idempotent)', () => {
    expect(isSettledVerification({ status: 'failed', verificationDigest: 'abc' })).toBe(true);
    expect(isSettledVerification({ status: 'completed', verificationDigest: 'abc' })).toBe(true);
    expect(isSettledVerification({ status: 'failed' })).toBe(false);
    expect(isSettledVerification({ status: 'running', executionPhase: 'verifying', verificationDigest: 'abc' })).toBe(false);
  });
});

describe('AgentMissionManager.list settles a stored stranded Mission', () => {
  it('persists the settlement, is not claimable, and Buscar más can start a new attempt that keeps it', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-settle-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'empleo de rider o delivery en España', categories: ['job'], keywords: ['rider', 'delivery'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => now });
    const created = await manager.create(goal.id, { agent: 'hermes', confirmed: true }, interactive);
    await store.project(async (data) => ({ changed: true, data: { ...data, agentMissions: [stranded({ id: created.id, goalId: goal.id, authorization: created.authorization })] } }));

    const [listed] = await manager.list();
    expect(listed).toMatchObject({ status: 'failed', executionPhase: 'failed', lastFailure: { code: VERIFIED_WITHOUT_SUPPORT } });
    expect((await store.read()).agentMissions[0].status).toBe('failed');

    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { automaticClaims: false });
    expect(await executor.claim('hermes')).toBeUndefined();

    const again = await manager.create(goal.id, { agent: 'hermes', confirmed: true, mode: 'search_more' }, interactive);
    expect(again).toMatchObject({ status: 'queued', searchMode: 'search_more', attempt: 0 });
    expect(again.priorAttempts.at(-1)).toMatchObject({ status: 'failed', executionPhase: 'failed' });
    expect(again.knownSourceUrls).toEqual(expect.arrayContaining(['https://a.example/', 'https://b.example/']));
  });
});
