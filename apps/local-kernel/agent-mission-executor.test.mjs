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
  it('leases a consented mission but refuses to seal Completado from Hermes snippets', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-')), 'store.json'));
    const unique = 'xyz-nonexist-token-9f3a';
    const goal = await new GoalManager(store).create({ title: `Locate record ${unique} in public filings`, categories: ['job'], keywords: [unique] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true, now: () => new Date('2026-07-22T18:00:00.000Z') });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store), { now: () => new Date('2026-07-22T18:01:00.000Z') });
    const claim = await executor.claim();
    expect(claim).toMatchObject({ id: mission.id, attempt: 1, scope: { categories: ['job'] }, leaseExpiresAt: '2026-07-22T18:31:00.000Z' });
    expect((await store.read()).agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating', investigatingAt: '2026-07-22T18:01:00.000Z' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{
      url: 'https://jwt.io/', title: `Search result ${unique}`,
      text: `UNTRUSTED SEARCH SNIPPET ${unique}`,
      discoveredAt: '2026-07-22T18:00:30.000Z',
    }] })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    const data = await store.read();
    expect(data.agentMissions[0]).toMatchObject({ status: 'running', executionPhase: 'investigating' });
    expect(data.agentMissions[0].executionPhase).not.toBe('forged');
    expect(data.evidence ?? []).toHaveLength(0);
    expect(data.opportunities ?? []).toHaveLength(0);
  });

  it('rejects invalid leases, private credential URLs, oversized batches and out-of-scope promotion', async () => {
    const store = new LocalKnowledgeStore(join(await mkdtemp(join(tmpdir(), 'efesto-executor-')), 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find grants', categories: ['grant'] });
    const manager = new AgentMissionManager(store, { isAgentReady: () => true });
    const mission = await manager.create(goal.id, { agent: 'hermes', confirmed: true });
    const executor = new AgentMissionExecutor(store, new OpportunityProjector(store));
    const claim = await executor.claim();
    await expect(executor.complete(mission.id, { leaseId: 'wrong', resultKind: 'search_candidates', findings: [] })).rejects.toMatchObject({ code: 'AGENT_MISSION_LEASE_INVALID' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{ url: 'https://user:pass@example.com', title: 'Bad', text: 'Bad' }] })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: [{ url: 'https://user:pass@example.com', title: 'Bad', text: 'Bad' }] })).rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, resultKind: 'search_candidates', findings: Array.from({ length: 21 }, () => ({})) })).rejects.toMatchObject({ code: 'INVALID_AGENT_RESULT' });
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [{
      url: 'https://jobs.example/out-of-scope', title: 'Remote AI engineer role', text: 'We are hiring. Open role with salary. Apply now. Full-time remote.',
    }] })).rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    expect((await store.read()).opportunities ?? []).toHaveLength(0);
    expect((await store.read()).agentMissions[0].executionPhase).not.toBe('forged');
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
    await expect(executor.complete(mission.id, { leaseId: claim.leaseId, findings: [finding, finding] }))
      .rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
    expect((await store.read()).evidence ?? []).toHaveLength(0);
    expect((await store.read()).agentMissions[0].status).not.toBe('completed');
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
      .rejects.toMatchObject({ code: 'AGENT_FINDINGS_NOT_EVIDENCE' });
  });
});
