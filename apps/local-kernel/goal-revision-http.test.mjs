import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { PageContextInbox } from './page-context-inbox.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { createLocalKernelServer } from './server.mjs';

const apiToken = 'goal-revision-http-test-token-at-least-32-chars';
const EXTENSION_ORIGIN = `chrome-extension://${'a'.repeat(32)}`;
let server;

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

async function start() {
  const dir = await mkdtemp(join(tmpdir(), 'efesto-goal-revision-http-'));
  const store = new LocalKnowledgeStore(join(dir, 'store.json'));
  const goals = new GoalManager(store);
  const goal = await goals.create({ title: 'quiero budcar empleo de ryder o delivery en españa', keywords: ['budcar', 'empleo', 'ryder', 'delivery', 'españa'] });
  const missions = new AgentMissionManager(store, { isAgentReady: () => true });
  const mission = await missions.create(goal.id, { agent: 'hermes', confirmed: true }, { confirmationActor: { actorType: 'interactive_user', decidedBy: 'dashboard-ui' } });
  server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
    apiToken, goalManager: goals, agentMissionManager: missions, allowedDashboardOrigins: ['https://efesto.example'],
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = `${base}/api/goals/${encodeURIComponent(goal.id)}/revisions`;
  const headers = { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' };
  const body = JSON.stringify({ confirmed: true, title: 'empleo de rider o delivery en España', keywords: ['empleo', 'rider', 'delivery', 'españa'], expectedRevision: 1 });
  return { store, goal, mission, base, endpoint, headers, body };
}

describe('POST /api/goals/:id/revisions — same interactive confirmation boundary as Missions', () => {
  it('token-only is refused with 403 and changes nothing', async () => {
    const { store, endpoint, headers, body } = await start();
    const before = await store.read();
    const response = await fetch(endpoint, { method: 'POST', headers, body });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ ok: false, code: 'GOAL_REVISION_CONFIRMATION_REQUIRED' });
    expect(await store.read()).toEqual(before);
  });

  it('a hostile browser origin is refused (403) before the Goal manager', async () => {
    const { store, endpoint, headers, body } = await start();
    const before = await store.read();
    const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: 'https://malicious.example' }, body });
    expect(response.status).toBe(403);
    expect(await store.read()).toEqual(before);
  });

  it('without the Kernel token the request is refused and changes nothing', async () => {
    const { store, endpoint, body } = await start();
    const before = await store.read();
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://efesto.example' }, body });
    expect(response.status).toBe(401);
    expect(await store.read()).toEqual(before);
  });

  it('the dashboard origin revises: same Goal id, revision 2, Mission id kept and re-authorized for revision 2', async () => {
    const { store, goal, mission, base, endpoint, headers, body } = await start();
    const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: 'https://efesto.example' }, body });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toMatchObject({ ok: true, changed: true, revision: 2, goal: { id: goal.id, title: 'empleo de rider o delivery en España', revision: 2, revisedBy: 'dashboard-ui', idBasis: 'created_content' } });
    expect(json.goal.keywords).not.toContain('budcar');
    expect(json.goal.keywords).not.toContain('ryder');
    expect(json.goal.keywords).toContain('rider');
    const listed = await (await fetch(`${base}/api/goals`, { headers })).json();
    expect(listed.goals.map((item) => item.id)).toEqual([goal.id]);
    const data = await store.read();
    expect(data.agentMissions).toHaveLength(1);
    expect(data.agentMissions[0]).toMatchObject({ id: mission.id, goalId: goal.id, goalTitle: 'empleo de rider o delivery en España', authorization: { goalRevision: 2, decidedBy: 'dashboard-ui' } });

    const stale = await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: 'https://efesto.example' }, body: JSON.stringify({ confirmed: true, title: 'empleo de rider en Madrid', expectedRevision: 1 }) });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'GOAL_REVISION_CONFLICT' });
  });

  it('the extension origin is an interactive confirmation too (decidedBy extension-ui)', async () => {
    const { endpoint, headers, body } = await start();
    const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, origin: EXTENSION_ORIGIN }, body });
    expect(response.status).toBe(200);
    expect((await response.json()).goal).toMatchObject({ revision: 2, revisedBy: 'extension-ui' });
  });

  it('415 without JSON, 400 without confirmed:true, 404 for an unknown Goal', async () => {
    const { base, endpoint, headers } = await start();
    const origin = 'https://efesto.example';
    expect((await fetch(endpoint, { method: 'POST', headers: { 'x-hephaestus-token': apiToken, 'content-type': 'text/plain', origin }, body: 'x' })).status).toBe(415);
    expect((await fetch(endpoint, { method: 'POST', headers: { ...headers, origin }, body: JSON.stringify({ title: 'empleo de rider' }) })).status).toBe(400);
    const missing = await fetch(`${base}/api/goals/${encodeURIComponent('goal:missing')}/revisions`, { method: 'POST', headers: { ...headers, origin }, body: JSON.stringify({ confirmed: true, title: 'empleo de rider' }) });
    expect(missing.status).toBe(404);
  });
});
