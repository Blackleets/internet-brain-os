import { mkdtemp, readFile } from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CaptureCaseEvidenceProjector, LocalKnowledgeStore } from './capture-projector.mjs';
import { PageContextInbox } from './page-context-inbox.mjs';
import { ObsidianKnowledgeProjector } from './obsidian-projector.mjs';
import { PairingSession } from './pairing-session.mjs';
import { createLocalKernelServer } from './server.mjs';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';

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
      ollama: 'configured',
      obsidian: 'configured',
    });
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
    expect(html).toContain('Authority boundary');
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
