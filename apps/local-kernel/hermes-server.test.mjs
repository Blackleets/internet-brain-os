import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PageContextInbox } from './page-context-inbox.mjs';
import { createLocalKernelServer } from './server.mjs';

let server;
const apiToken = 'test-token-that-is-at-least-32-characters';

afterEach(async () => {
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
});

describe('local Kernel Hermes route wiring', () => {
  it('leaves Hermes ingestion disabled unless a route is configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-http-'));
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, { apiToken });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    const response = await fetch(`http://127.0.0.1:${port}/hermes/ingestions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });

    expect(await health.json()).toMatchObject({ ok: true, hermes: false });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, code: 'HERMES_INGESTION_DISABLED' });
  });

  it('forwards local Hermes POST requests to the configured route without extension API token auth', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hephaestus-hermes-http-'));
    const calls = [];
    server = createLocalKernelServer(new PageContextInbox(join(dir, 'inbox.jsonl')), undefined, undefined, undefined, {
      apiToken,
      hermesRoute: {
        async handle(request) {
          calls.push(request);
          return { status: 202, body: { ok: true, recordId: 'cognitive-record:sample' } };
        },
      },
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    const response = await fetch(`http://127.0.0.1:${port}/hermes/ingestions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ibos-idempotency-key': 'sample-key',
        'x-ibos-timestamp': '2026-07-19T22:00:00.000Z',
        'x-ibos-signature': 'sample-signature',
      },
      body: JSON.stringify({ recordId: 'record:1' }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true, recordId: 'cognitive-record:sample' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/hermes/ingestions',
      rawBody: JSON.stringify({ recordId: 'record:1' }),
    });
    expect(calls[0].headers['x-ibos-idempotency-key']).toBe('sample-key');
  });
});
