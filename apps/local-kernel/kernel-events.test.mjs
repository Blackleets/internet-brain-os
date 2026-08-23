import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalKernelServer } from './server.mjs';

const apiToken = 'test-token-for-events-contract-0123456789abcdef';

describe('kernel events SSE endpoint', () => {
  let server;
  let baseUrl;
  let directory;

  before(async () => {
    directory = await mkdtemp(join(tmpdir(), 'hephaestus-events-'));
    server = createLocalKernelServer(undefined, undefined, undefined, undefined, { apiToken });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  async function openStream(pathname, headers = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      headers: { 'x-hephaestus-token': apiToken, ...headers },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);
    return response;
  }

  async function readFrames(response, count = 1, timeoutMs = 3_000) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const deadline = Date.now() + timeoutMs;
    let buffer = '';
    while (Date.now() < deadline) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), Math.max(deadline - Date.now(), 1))),
      ]);
      if (chunk.timeout || chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split('\n\n').filter((part) => part.length > 0);
      if (frames.length >= count) break;
    }
    reader.cancel().catch(() => {});
    return buffer;
  }

  it('requires kernel token auth like every other /api route', async () => {
    const response = await fetch(`${baseUrl}/api/events`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, code: 'AUTH_REQUIRED' });
  });

  it('streams domain events published through the kernel event bus', async () => {
    const stream = await openStream('/api/events');
    // Give the handler a tick to attach before publishing.
    await new Promise((resolve) => setTimeout(resolve, 50));
    server.kernelEvents.publish('mission.updated', { missionId: 'mission-1', status: 'verifying' });

    // Frame 1 is the ': connected' comment; frame 2 is the published event.
    const buffer = await readFrames(stream, 2);
    assert.match(buffer, /event: mission\.updated/);
    assert.match(buffer, /data: \{"missionId":"mission-1","status":"verifying"\}/);
    stream.body.cancel().catch(() => {});
  });

  it('sends an initial connected comment so clients know the stream is live', async () => {
    const stream = await openStream('/api/events');
    const frame = await readFrames(stream, 1);
    assert.match(frame, /: connected/);
    stream.body.cancel().catch(() => {});
  });
});
