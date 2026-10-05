import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { AGENT_ONLINE_WINDOW_MS, AgentPresence, describeAgent } from './agent-presence.mjs';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { PageContextInbox } from './page-context-inbox.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { createLocalKernelServer } from './server.mjs';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';

const T0 = new Date('2026-10-04T10:00:00.000Z');
const at = (ms) => new Date(T0.getTime() + ms);

describe('describeAgent: connection states only from Kernel-observed facts', () => {
  it('never → history → seen → online → working, each from a real fact', () => {
    expect(describeAgent('hermes', { now: T0 }).state).toBe('never');
    const finished = { id: 'm1', agent: 'hermes', status: 'completed', executionPhase: 'forged', claimedAt: '2026-10-03T09:00:00.000Z', forgedAt: '2026-10-03T09:05:00.000Z', verificationResults: [{ candidateId: 'c1', status: 'verified', evidenceId: 'evidence:1', supported: true }] };
    const history = describeAgent('hermes', { now: T0, missions: [finished] });
    expect(history).toMatchObject({ state: 'history', lastClaimAt: finished.claimedAt, lastMission: { id: 'm1', phase: 'forged', at: finished.forgedAt } });
    expect(describeAgent('hermes', { now: at(AGENT_ONLINE_WINDOW_MS + 1), contact: { lastSeenAt: T0.toISOString(), lastSeenVia: 'poll' } }).state).toBe('seen');
    expect(describeAgent('hermes', { now: at(5_000), contact: { lastSeenAt: T0.toISOString(), lastSeenVia: 'poll' } }).state).toBe('online');
    const running = { id: 'm2', agent: 'hermes', status: 'running', leaseId: 'l', claimedAt: T0.toISOString(), leaseExpiresAt: at(60_000).toISOString(), attempt: 2 };
    expect(describeAgent('hermes', { now: at(1_000), missions: [finished, running] })).toMatchObject({ state: 'working', activeMission: { id: 'm2', attempt: 2 } });
  });

  it('an expired lease is not "working", and missions of other agents do not count', () => {
    const expired = { id: 'm3', agent: 'hermes', status: 'running', leaseId: 'l', claimedAt: T0.toISOString(), leaseExpiresAt: at(1_000).toISOString() };
    expect(describeAgent('hermes', { now: at(2_000), missions: [expired] }).state).toBe('history');
    expect(describeAgent('hermes', { now: T0, missions: [{ id: 'x', agent: 'other', claimedAt: T0.toISOString() }] }).state).toBe('never');
  });

  it('never reports a last Mission as forged without a Kernel SUPPORT verdict on fetched Evidence', () => {
    const base = { agent: 'hermes', status: 'completed', claimedAt: '2026-10-03T09:00:00.000Z', completedAt: '2026-10-03T09:05:00.000Z' };
    // Public discovery with zero candidates / snippet-only result: completed, but nothing was forged.
    expect(describeAgent('hermes', { now: T0, missions: [{ ...base, id: 'empty' }] }).lastMission.phase).toBe('completed_without_forge');
    // A forged stamp with no supported verificationResults (or HTTP 200 read without SUPPORT) is not a Find.
    const unsupported = { ...base, id: 'ash', executionPhase: 'forged', forgedAt: base.completedAt, verificationResults: [{ candidateId: 'c', status: 'verified', evidenceId: 'evidence:jwt', supported: false }] };
    expect(describeAgent('hermes', { now: T0, missions: [unsupported] }).lastMission.phase).toBe('completed_without_forge');
    expect(describeAgent('hermes', { now: T0, missions: [{ ...base, id: 'stamp', executionPhase: 'forged', forgedAt: base.completedAt }] }).lastMission.phase).toBe('completed_without_forge');
    const supportedNoEvidence = { ...unsupported, id: 'noev', verificationResults: [{ candidateId: 'c', status: 'verified', supported: true }] };
    expect(describeAgent('hermes', { now: T0, missions: [supportedNoEvidence] }).lastMission.phase).toBe('completed_without_forge');
    const forged = { ...unsupported, id: 'gold', verificationResults: [{ candidateId: 'c', status: 'verified', evidenceId: 'evidence:drill', supported: true }] };
    expect(describeAgent('hermes', { now: T0, missions: [forged] }).lastMission.phase).toBe('forged');
    // Non-completed Missions keep their real phase; a stray forged phase on them is never echoed.
    expect(describeAgent('hermes', { now: T0, missions: [{ ...base, id: 'f', status: 'failed', executionPhase: 'failed', failedAt: base.completedAt }] }).lastMission.phase).toBe('failed');
    expect(describeAgent('hermes', { now: T0, missions: [{ ...base, id: 'r', status: 'running', executionPhase: 'forged' }] }).lastMission.phase).toBe('running');
  });

  it('counts queued missions waiting for the agent', () => {
    expect(describeAgent('hermes', { now: T0, missions: [{ id: 'q', agent: 'hermes', status: 'queued' }] }).queuedMissions).toBe(1);
  });

  it('AgentPresence only accepts known agents and contact kinds', () => {
    const presence = new AgentPresence({ now: () => T0 });
    expect(presence.record('mallory', 'ping')).toBeUndefined();
    expect(presence.record('hermes', 'teleport')).toBeUndefined();
    presence.record('hermes', 'claim');
    expect(presence.contact('hermes')).toEqual({ lastSeenAt: T0.toISOString(), lastSeenVia: 'claim', lastClaimAt: T0.toISOString() });
  });
});

describe('GET /api/agents and POST /api/agents/hermes/ping', () => {
  const apiToken = 'agent-presence-http-test-token-at-least-32';
  let server;
  afterEach(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

  async function start() {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-agent-presence-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const goals = new GoalManager(store);
    const missions = new AgentMissionManager(store, { isAgentReady: () => true });
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      apiToken, goalManager: goals, agentMissionManager: missions, agentMissionExecutor: new AgentMissionExecutor(store, new OpportunityProjector(store)), allowedDashboardOrigins: ['https://efesto.example'],
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }

  it('requires the token, reports "never" before any contact and "online" after a worker ping', async () => {
    const base = await start();
    expect((await fetch(`${base}/api/agents`)).status).toBe(401);
    const before = await (await fetch(`${base}/api/agents`, { headers: { 'x-hephaestus-token': apiToken } })).json();
    expect(before).toMatchObject({ ok: true, schemaVersion: 'efesto.agents.v1', agents: [{ id: 'hermes', state: 'never' }] });
    expect((await fetch(`${base}/api/agents/hermes/ping`, { method: 'POST' })).status).toBe(401);
    const ping = await fetch(`${base}/api/agents/hermes/ping`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken } });
    expect(ping.status).toBe(200);
    const after = await (await fetch(`${base}/api/agents`, { headers: { 'x-hephaestus-token': apiToken } })).json();
    expect(after.agents[0]).toMatchObject({ state: 'online', lastSeenVia: 'ping' });
  });

  it('the dashboard (or any browser origin) cannot fake a connection with the ping', async () => {
    const base = await start();
    const response = await fetch(`${base}/api/agents/hermes/ping`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken, origin: 'https://efesto.example' } });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'AGENT_PING_BROWSER_FORBIDDEN' });
    const after = await (await fetch(`${base}/api/agents`, { headers: { 'x-hephaestus-token': apiToken, origin: 'https://efesto.example' } })).json();
    expect(after.agents[0].state).toBe('never');
  });

  it('a worker polling for missions (204, nothing queued) counts as an observed contact', async () => {
    const base = await start();
    const claim = await fetch(`${base}/api/agent-missions/claim`, { method: 'POST', headers: { 'x-hephaestus-token': apiToken } });
    expect(claim.status).toBe(204);
    const after = await (await fetch(`${base}/api/agents`, { headers: { 'x-hephaestus-token': apiToken } })).json();
    expect(after.agents[0]).toMatchObject({ state: 'online', lastSeenVia: 'poll' });
  });
});
