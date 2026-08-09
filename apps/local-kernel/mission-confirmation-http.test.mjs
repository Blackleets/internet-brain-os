import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { PageContextInbox } from './page-context-inbox.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { createLocalKernelServer } from './server.mjs';

const apiToken = 'g4-confirmation-test-token-at-least-32-chars';
let server;

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

describe('Mission HTTP confirmation authority boundary', () => {
  it('does not convert token-only confirmed:true into automatic user authority, but a trusted dashboard origin can confirm the same live Mission', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-g4-confirmation-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find safe public offers', categories: ['offer'] });
    const missions = new AgentMissionManager(store, { isAgentReady: () => true, now: () => new Date('2026-08-09T20:30:00.000Z') });
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      apiToken,
      agentMissionManager: missions,
      allowedDashboardOrigins: ['https://efesto.example'],
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/api/goals/${encodeURIComponent(goal.id)}/missions`;
    const headers = { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' };
    const body = JSON.stringify({ agent: 'hermes', confirmed: true });

    const tokenOnly = await fetch(endpoint, { method: 'POST', headers, body });
    expect(tokenOnly.status).toBe(201);
    expect((await tokenOnly.json()).mission.authorization).toBeUndefined();

    const interactive = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, origin: 'https://efesto.example' },
      body,
    });
    expect(interactive.status).toBe(201);
    expect((await interactive.json()).mission.authorization).toMatchObject({
      actorType: 'interactive_user',
      decidedBy: 'dashboard-ui',
      goalId: goal.id,
      goalRevision: 1,
      scope: 'read_only_continuation',
    });
  });

  it('rejects a hostile browser origin before Mission confirmation reaches the manager', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-g4-confirmation-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const goal = await new GoalManager(store).create({ title: 'Find safe tools', categories: ['tool'] });
    const missions = new AgentMissionManager(store, { isAgentReady: () => true });
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, { apiToken, agentMissionManager: missions });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/goals/${encodeURIComponent(goal.id)}/missions`, {
      method: 'POST',
      headers: { 'x-hephaestus-token': apiToken, 'content-type': 'application/json', origin: 'https://malicious.example' },
      body: JSON.stringify({ agent: 'hermes', confirmed: true }),
    });
    expect(response.status).toBe(403);
    expect((await store.read()).agentMissions ?? []).toHaveLength(0);
  });
});
