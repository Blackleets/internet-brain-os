import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { GoalManager } from './goals.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

describe('external agent mission executor boundary', () => {
  it('leases a consented mission and converts bounded public results into Evidence and Opportunities', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find remote AI work', categories: ['job'], keywords: ['remote'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => new Date('2026-07-22T18:00:00.000Z') });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { now: () => new Date('2026-07-22T18:01:00.000Z') });
    const claim = await executor.claim();
    expect(claim).toMatchObject({ id: mission.id, attempt: 1, scope: { categories: ['job'] }, leaseExpiresAt: '2026-07-22T18:31:00.000Z' });
    expect((await store.read()).agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating', investigatingAt: '2026-07-22T18:01:00.000Z' });
    const completed = await executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{
      url: 'https://jobs.example/ai', title: 'Remote AI engineer role',
      text: 'We are hiring. Open role with salary, full-time remote. Apply now.',
      discoveredAt: '2026-07-22T18:00:30.000Z',
    }] });
    expect(completed.mission).toMatchObject({ status: 'completed', executionPhase: 'forged', verifyingAt: '2026-07-22T18:01:00.000Z', forgedAt: '2026-07-22T18:01:00.000Z', resultSummary: { received: 1, evidenceCreated: 1, opportunitiesPromoted: 1 } });
    const data = await store.read();
    expect(data.evidence).toHaveLength(1);
    expect(data.evidence[0]).toMatchObject({ missionId: mission.id, confidence: 0.4, tags: ['agent-research', 'unverified'] });
    expect(data.opportunities).toHaveLength(1);
  });

  it('rejects invalid leases, private credential URLs, oversized batches and out-of-scope promotion', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find grants', categories: ['grant'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();
    await expect(executor.complete(mission.id, { leaseId: 'wrong', findings: [] })).rejects.toMatchObject({ code: 'AGENT_MISSION_LEASE_INVALID' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{ url: 'https://user:pass@example.com', title: 'Bad', text: 'Bad' }] })).rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: Array.from({ length: 21 }, () => ({})) })).rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
    const result = await executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{
      url: 'https://jobs.example/out-of-scope', title: 'Remote AI engineer role', text: 'We are hiring. Open role with salary. Apply now. Full-time remote.',
    }] });
    expect(result.findings[0].status).toBe('out_of_scope');
    expect((await store.read()).opportunities).toHaveLength(0);
  });

  it('records bounded failures and stops retrying after three attempts', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find grants', categories: ['grant'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const claim = await executor.claim();
      const failed = await executor.fail(mission.id, { leaseId: claim.leaseId, reason: 'Provider temporarily unavailable' });
      expect(failed).toMatchObject({ status: attempt === 3 ? 'failed' : 'queued', executionPhase: attempt === 3 ? 'failed' : 'queued', lastFailure: { attempt } });
    }
    expect(await executor.claim()).toBeUndefined();
  });

  it('counts only newly created Evidence when a result batch repeats a URL', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-duplicates-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find remote AI work', categories: ['job'] });
    const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();
    const finding = { url: 'https://jobs.example/repeated', title: 'Remote AI role', text: 'We are hiring for a full-time remote role with salary. Apply now.' };
    const completed = await executor.complete(mission.id, { leaseId: claim.leaseId, findings: [finding, finding] });
    expect(completed.mission.resultSummary).toMatchObject({ received: 2, evidenceCreated: 1 });
    expect((await store.read()).evidence).toHaveLength(1);
  });

  it.each([
    'http://[::1]/finding',
    'http://[fd00::1]/finding',
    'http://[fe80::1]/finding',
    'http://[::ffff:127.0.0.1]/finding',
    'http://[::ffff:192.168.1.2]/finding',
  ])('rejects private IPv6 mission result URL %s', async (url) => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-ipv6-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find grants', categories: ['grant'] });
    const mission = await new AgentMissionManager(store, { isAgentReady: () => true }).create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{ url, title: 'Private', text: 'Private result' }] }))
      .rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
  });
});
