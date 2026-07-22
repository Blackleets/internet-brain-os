import { mkdtemp, readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CaptureCaseEvidenceProjector, LocalKnowledgeStore } from './capture-projector.mjs';
import { PageContextInbox } from './page-context-inbox.mjs';
import { ObsidianKnowledgeProjector } from './obsidian-projector.mjs';
import { OptionalEvidenceSummarizer } from './optional-evidence-summarizer.mjs';
import { PairingSession } from './pairing-session.mjs';
import { createLocalKernelServer } from './server.mjs';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';
import { OpportunityProjector } from './opportunity-classifier.mjs';
import { PreferenceLearner } from './preference-learner.mjs';
import { GoalManager } from './goals.mjs';
import { AgentMissionManager } from './agent-missions.mjs';
import { AgentMissionExecutor } from './agent-mission-executor.mjs';
import { ModelForge } from './model-forge.mjs';

let server;
const apiToken = 'test-token-that-is-at-least-32-characters';
const authHeaders = { 'x-hephaestus-token': apiToken };

function testServer(inbox, projector, obsidianProjector, evidenceSummarizer, options = {}) {
  return createLocalKernelServer(inbox, projector, obsidianProjector, evidenceSummarizer, { apiToken, ...options });
}
afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

describe('local Kernel HTTP receiver', () => {
  it('refuses weak configured API tokens', () => {
    expect(() => createLocalKernelServer({}, undefined, undefined, undefined, { apiToken: 'short' }))
      .toThrow('HEPHAESTUS_API_TOKEN must contain 32-512 characters');
  });

  it('reports safe local readiness without exposing configuration secrets', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/status`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      service: 'hephaestus-local-kernel',
      kernel: 'ready',
      hermes: 'disabled',
      replayLab: 'disabled',
      ollama: 'not_configured',
      obsidian: 'not_configured',
    });
  });

  it('reports Ollama configured only when the summarizer has a model', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const withoutModel = new OptionalEvidenceSummarizer(store);
    const withModel = new OptionalEvidenceSummarizer(store, {
      model: 'local-test-model',
      baseUrl: 'http://127.0.0.1:11434',
    });

    server = testServer(
      new PageContextInbox(join(dir, 'inbox-without-model.jsonl')),
      undefined,
      undefined,
      withoutModel,
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    let port = server.address().port;
    const withoutModelStatus = await (await fetch(`http://127.0.0.1:${port}/status`)).json();
    await new Promise((resolve) => server.close(resolve));

    server = testServer(
      new PageContextInbox(join(dir, 'inbox-with-model.jsonl')),
      undefined,
      undefined,
      withModel,
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    const withModelStatus = await (await fetch(`http://127.0.0.1:${port}/status`)).json();

    expect(withoutModelStatus.ollama).toBe('not_configured');
    expect(withModelStatus.ollama).toBe('configured');
    expect(JSON.stringify(withModelStatus)).not.toContain('local-test-model');
    expect(JSON.stringify(withModelStatus)).not.toContain('11434');
  });

  it('keeps Model Forge hardware and runtime inspection behind local authentication', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const modelForge = new ModelForge({
      ramGiB: 8,
      cpuCores: 4,
      fetchImpl: async () => ({ ok: true, json: async () => ({ models: [{ name: 'qwen3:4b' }] }) }),
    });
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, { modelForge });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/model-forge`;

    expect((await fetch(url)).status).toBe(401);
    const response = await fetch(url, { headers: authHeaders });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.forge).toMatchObject({ runtime: 'available', hardware: { ramGiB: 8, cpuCores: 4, tier: 'balanced' } });
    expect(payload.forge.models.find((model) => model.id === 'qwen3:4b')).toMatchObject({ installed: true, compatible: true });
  });

  it('accepts extension context and returns an idempotent receipt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const projector = new CaptureCaseEvidenceProjector(new LocalKnowledgeStore(join(dir, 'store.json')));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), projector);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/browser/page-context`;
    const body = JSON.stringify({
      schemaVersion: 'hephaestus.page-context.v1',
      url: 'https://example.com/',
      title: 'Example',
      visibleText: 'Public evidence',
      capturedAt: '2026-07-19T11:00:00.000Z',
    });

    const first = await fetch(url, { method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body });
    const retry = await fetch(url, { method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body });
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({
      ok: true,
      duplicate: false,
      caseId: expect.stringMatching(/^case:[a-f0-9]{64}$/),
      evidenceId: expect.stringMatching(/^evidence:[a-f0-9]{64}$/),
    });
    expect(await retry.json()).toMatchObject({ ok: true, duplicate: true });
    const stored = JSON.parse(await readFile(join(dir, 'store.json'), 'utf8'));
    expect(stored.cases).toHaveLength(1);
    expect(stored.evidence).toHaveLength(1);
  });

  it('rejects invalid JSON without exposing internals', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/browser/page-context`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: 'INVALID_JSON', error: 'Request body must be valid JSON' });
  });

  it('blocks hostile browser origins and simple-request content types', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/browser/page-context`;

    const hostile = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders, origin: 'https://malicious.example', 'content-type': 'application/json' },
      body: '{}',
    });
    const simple = await fetch(url, { method: 'POST', headers: { ...authHeaders, 'content-type': 'text/plain' }, body: '{}' });

    expect(hostile.status).toBe(403);
    expect(await hostile.json()).toEqual({ ok: false, code: 'ORIGIN_FORBIDDEN' });
    expect(simple.status).toBe(415);
    expect(await simple.json()).toEqual({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });

  it('lists active Cases for the extension popup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({
      cases: [
        { id: 'case:active', title: 'Active Case', status: 'active' },
        { id: 'case:archived', title: 'Archived Case', status: 'archived' },
      ],
      evidence: [],
    });
    server = testServer(
      new PageContextInbox(join(dir, 'inbox.jsonl')),
      new CaptureCaseEvidenceProjector(store),
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/cases`, { headers: authHeaders });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      cases: [{ id: 'case:active', title: 'Active Case', status: 'active' }],
    });
  });

  it('classifies captured pages and serves the private Opportunity inbox', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-inbox-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const projector = new CaptureCaseEvidenceProjector(store);
    const opportunities = new OpportunityProjector(store);
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), projector, new ObsidianKnowledgeProjector(store, join(dir, 'vault')), undefined, {
      opportunityProjector: opportunities,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const capture = await fetch(`http://127.0.0.1:${port}/api/browser/page-context`, {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'hephaestus.page-context.v1', url: 'https://careers.example.com/role',
        title: 'We are hiring a remote AI engineer',
        visibleText: 'Open role with salary. Full-time remote position. Apply now. Deadline: August 14, 2026.',
        capturedAt: '2026-07-22T18:00:00.000Z',
      }),
    });
    const captured = await capture.json();
    expect(captured).toMatchObject({
      ok: true, opportunity: { status: 'opportunity', opportunity: { category: 'job' } },
    });
    const opportunityId = captured.opportunity.opportunity.id.replace(/[^A-Za-z0-9._-]/g, '-');
    const note = await readFile(join(dir, 'vault', 'Opportunities', `${opportunityId}.md`), 'utf8');
    expect(note).toContain('type: opportunity');
    expect(note).toContain('This is a deterministic lead, not a verified recommendation.');

    const inbox = await fetch(`http://127.0.0.1:${port}/api/opportunities`, { headers: authHeaders });
    expect(inbox.status).toBe(200);
    expect(await inbox.json()).toMatchObject({
      ok: true, opportunities: [{ category: 'job', sourceHost: 'careers.example.com' }],
    });
  });

  it('records authenticated feedback and exposes an erasable local preference profile', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-feedback-http-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    await store.write({ opportunities: [{ id: 'opportunity:abc', category: 'job', benefitType: 'income', sourceHost: 'jobs.example' }] });
    const preferences = new PreferenceLearner(store);
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, { preferenceLearner: preferences });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const endpoint = `http://127.0.0.1:${port}`;
    const unauthorized = await fetch(`${endpoint}/api/opportunities/${encodeURIComponent('opportunity:abc')}/feedback`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signal: 'useful' }) });
    expect(unauthorized.status).toBe(401);
    const feedback = await fetch(`${endpoint}/api/opportunities/${encodeURIComponent('opportunity:abc')}/feedback`, { method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ signal: 'useful' }) });
    expect(feedback.status).toBe(201);
    expect(await feedback.json()).toMatchObject({ ok: true, feedback: { signal: 'useful', category: 'job' } });
    expect(await (await fetch(`${endpoint}/api/preferences`, { headers: authHeaders })).json()).toMatchObject({ ok: true, profile: { eventCount: 1, categories: { job: 6 } } });
    expect(await (await fetch(`${endpoint}/api/preferences`, { method: 'DELETE', headers: authHeaders })).json()).toEqual({ ok: true, reset: true });
  });

  it('lets an authenticated Hermes worker claim a consented mission and return bounded public Evidence', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'efesto-agent-http-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const goals = new GoalManager(store);
    const goal = await goals.create({ title: 'Find remote AI work', categories: ['job'], keywords: ['remote'] });
    const missions = new AgentMissionManager(store, { isAgentReady: () => true });
    await missions.create(goal.id, { agent: 'hermes', confirmed: true });
    const opportunities = new OpportunityProjector(store);
    const executor = new AgentMissionExecutor(store, opportunities);
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, new ObsidianKnowledgeProjector(store, join(dir, 'vault')), undefined, {
      agentMissionManager: missions, agentMissionExecutor: executor, opportunityProjector: opportunities,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}`;
    expect((await fetch(`${endpoint}/api/agent-missions/claim`, { method: 'POST' })).status).toBe(401);
    const claimResponse = await fetch(`${endpoint}/api/agent-missions/claim`, { method: 'POST', headers: authHeaders });
    expect(claimResponse.status).toBe(200);
    const { mission } = await claimResponse.json();
    const completed = await fetch(`${endpoint}/api/agent-missions/${encodeURIComponent(mission.id)}/results`, {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ leaseId: mission.leaseId, findings: [{
        url: 'https://jobs.example/remote-ai', title: 'Remote AI engineer role',
        text: 'We are hiring. Open role with salary. Apply now for this full-time remote position.',
      }] }),
    });
    expect(completed.status).toBe(202);
    expect(await completed.json()).toMatchObject({ ok: true, mission: { status: 'completed' }, findings: [{ opportunity: { opportunity: { category: 'job' } } }] });
    const evidenceId = (await store.read()).evidence[0].id.replace(/[^A-Za-z0-9._-]/g, '-');
    expect(await readFile(join(dir, 'vault', 'Evidence', `${evidenceId}.md`), 'utf8')).toContain('hermes-public-research-v1');
  });

  it('lists Replay Lab cases through the authenticated local API', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const caseView = { id: 'pipeline:1', recordedAt: '2026-07-20T00:00:00.000Z', status: 'admitted' };
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      replayLabQuery: { listCases: async () => [caseView], getCase: async () => caseView },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/api/replay-lab/cases`, { headers: authHeaders });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, cases: [caseView] });
  });

  it('fetches one Replay Lab case by encoded id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const caseView = { id: 'pipeline:encoded/1', recordedAt: '2026-07-20T00:00:00.000Z', status: 'rejected' };
    let requestedId;
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      replayLabQuery: {
        listCases: async () => [caseView],
        getCase: async (id) => { requestedId = id; return caseView; },
      },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/api/replay-lab/cases/${encodeURIComponent(caseView.id)}`, { headers: authHeaders });

    expect(response.status).toBe(200);
    expect(requestedId).toBe(caseView.id);
    expect(await response.json()).toEqual({ ok: true, case: caseView });
  });

  it('keeps Replay Lab unavailable unless configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/api/replay-lab/cases`, { headers: authHeaders });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, code: 'REPLAY_LAB_UNAVAILABLE' });
  });

  it('validates and ingests a Hermes capture through separate authenticated actions', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const calls = [];
    const hermesImportService = {
      validate: (body) => ({ runOutput: { runId: 'real-run-1' }, idempotencyKey: 'hermes-agent-real-run-1', events: [1, 2] }),
      ingest: async (body) => { calls.push(body); return { recordId: 'pipeline-hermes-agent-real-run-1' }; },
    };
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, { hermesImportService });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const payload = { format: 'json', content: '{"runId":"real-run-1"}' };

    const validate = await fetch(`http://127.0.0.1:${port}/api/replay-lab/imports/validate`, {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });
    const ingest = await fetch(`http://127.0.0.1:${port}/api/replay-lab/imports`, {
      method: 'POST', headers: { ...authHeaders, 'content-type': 'application/json' }, body: JSON.stringify(payload),
    });

    expect(await validate.json()).toEqual({ ok: true, runId: 'real-run-1', idempotencyKey: 'hermes-agent-real-run-1', eventCount: 2 });
    expect(ingest.status).toBe(202);
    expect(await ingest.json()).toMatchObject({ ok: true, recordId: 'pipeline-hermes-agent-real-run-1' });
    expect(calls).toEqual([payload]);
  });

  it('requires the local API token before Hermes import validation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      hermesImportService: { validate: () => { throw new Error('must not run'); } },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/replay-lab/imports/validate`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    expect(response.status).toBe(401);
  });

  it('serves the minimal Replay Lab operator page without exposing the API token', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/replay-lab`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Replay Lab');
    expect(html).toContain('/api/replay-lab/cases');
    expect(html).toContain('/api/replay-lab/imports/validate');
    expect(html).toContain('Import real Hermes run');
    expect(html).toContain('Authority boundary');
    expect(html).toContain('AI Autopsy');
    expect(html).toContain('Prevention Rules');
    expect(html).toContain('Rejected payload contents are not persisted.');
    expect(html).not.toContain(apiToken);
  });

  it('updates Obsidian notes after a successful capture projection', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const store = new LocalKnowledgeStore(join(dir, 'store.json'));
    const projector = new CaptureCaseEvidenceProjector(store);
    server = testServer(
      new PageContextInbox(join(dir, 'inbox.jsonl')),
      projector,
      new ObsidianKnowledgeProjector(store, join(dir, 'vault')),
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/browser/page-context`, {
      method: 'POST',
      headers: { ...authHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 'hephaestus.page-context.v1', url: 'https://example.com/', title: 'Example',
        visibleText: 'Public Evidence', capturedAt: '2026-07-19T11:00:00.000Z',
      }),
    });
    const body = await response.json();
    expect(body.obsidianNotes).toMatchObject({ caseNote: expect.stringContaining('Cases/') });
    expect(await readFile(join(dir, 'vault', body.obsidianNotes.caseNote), 'utf8')).toContain('# Example');
  });

  it('requires a timing-safe bearer token for every API route', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/cases`;
    const replayLabUrl = `http://127.0.0.1:${port}/api/replay-lab/cases`;

    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, { headers: { 'x-hephaestus-token': `${apiToken}x` } })).status).toBe(401);
    expect((await fetch(replayLabUrl)).status).toBe(401);
  });

  it('pairs once with an expiring bounded-attempt code and never exposes it through health', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    const pairing = new PairingSession(apiToken, { code: 'ABCD2345', expiresAt: 2_000, now: () => 1_000 });
    const identities = new ExtensionIdentityRegistry(join(dir, 'extensions.json'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      pairingSession: pairing, extensionRegistry: identities,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}`;

    expect(JSON.stringify(await (await fetch(`${base}/health`)).json())).not.toContain('ABCD2345');
    const paired = await fetch(`${base}/pair`, {
      method: 'POST', headers: { origin: `chrome-extension://${'a'.repeat(32)}`, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'abcd-2345' }),
    });
    expect(paired.status).toBe(200);
    expect(await paired.json()).toEqual({ ok: true, apiToken });
    const trustedOrigin = `chrome-extension://${'a'.repeat(32)}`;
    const attackerOrigin = `chrome-extension://${'b'.repeat(32)}`;
    const trusted = await fetch(`${base}/api/cases`, { headers: { ...authHeaders, origin: trustedOrigin } });
    const attacker = await fetch(`${base}/api/cases`, { headers: { ...authHeaders, origin: attackerOrigin } });
    expect(trusted.status).toBe(404);
    expect(attacker.status).toBe(403);
    expect(await attacker.json()).toEqual({ ok: false, code: 'EXTENSION_NOT_AUTHORIZED' });
    const reused = await fetch(`${base}/pair`, {
      method: 'POST', headers: { origin: `chrome-extension://${'a'.repeat(32)}`, 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ABCD2345' }),
    });
    expect(reused.status).toBe(410);
    expect(await reused.json()).toEqual({ ok: false, code: 'PAIRING_ALREADY_USED' });

    const noOrigin = await fetch(`${base}/pair`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'ABCD2345' }),
    });
    expect(noOrigin.status).toBe(403);
    expect(await noOrigin.json()).toEqual({ ok: false, code: 'PAIRING_ORIGIN_REQUIRED' });
  });

  it('rejects non-loopback Host headers before routing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = testServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await rawRequest(port, 'attacker.example');
    expect(response.status).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ ok: false, code: 'HOST_FORBIDDEN' });
  });
});

function rawRequest(port, host) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path: '/health', headers: { host } }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end();
  });
}
