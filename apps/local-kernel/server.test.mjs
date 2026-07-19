import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PageContextInbox } from './page-context-inbox.mjs';
import { createLocalKernelServer } from './server.mjs';

let server;
afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

describe('local Kernel HTTP receiver', () => {
  it('accepts extension context and returns an idempotent receipt', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
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

    const first = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    const retry = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({ ok: true, duplicate: false });
    expect(await retry.json()).toMatchObject({ ok: true, duplicate: true });
  });

  it('rejects invalid JSON without exposing internals', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/browser/page-context`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, code: 'INVALID_JSON', error: 'Request body must be valid JSON' });
  });

  it('blocks hostile browser origins and simple-request content types', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-http-'));
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')));
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/browser/page-context`;

    const hostile = await fetch(url, {
      method: 'POST',
      headers: { origin: 'https://malicious.example', 'content-type': 'application/json' },
      body: '{}',
    });
    const simple = await fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' });

    expect(hostile.status).toBe(403);
    expect(await hostile.json()).toEqual({ ok: false, code: 'ORIGIN_FORBIDDEN' });
    expect(simple.status).toBe(415);
    expect(await simple.json()).toEqual({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});
