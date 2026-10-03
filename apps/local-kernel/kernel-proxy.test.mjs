import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createKernelProxyHandler } from './kernel-proxy.mjs';

// The one-click Kernel proxy buffered every upstream body (arrayBuffer). /api/events (SSE)
// never ends, so dashboard live events never arrived through the public port, chat NDJSON
// deltas arrived only at the end, and each abandoned event stream kept an upstream Kernel
// subscription open forever (the bus caps at 16, then answers EVENT_STREAM_FULL).
const servers = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function listen(handler) {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

function readUntil(url, marker, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; if (body.includes(marker)) resolve({ request, response, body }); });
      response.on('end', () => resolve({ request, response, body }));
    });
    request.on('error', reject);
    request.setTimeout(2000, () => { request.destroy(); reject(new Error(`timed out waiting for ${JSON.stringify(marker)}`)); });
  });
}

describe('one-click Kernel proxy streaming', () => {
  it('forwards SSE frames as they happen and releases the upstream stream when the client leaves', async () => {
    let upstreamClosed = false;
    const internalBaseUrl = await listen((request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
      response.write(': connected\n\nevent: mission.updated\ndata: {"id":"m1"}\n\n');
      request.on('close', () => { upstreamClosed = true; });
    });
    const proxyUrl = await listen(createKernelProxyHandler({ internalBaseUrl }));
    const { request, response, body } = await readUntil(`${proxyUrl}/api/events`, 'mission.updated');
    expect(response.statusCode).toBe(200);
    expect(String(response.headers['content-type'])).toContain('text/event-stream');
    expect(body).toContain('data: {"id":"m1"}');
    request.destroy();
    const deadline = Date.now() + 2000;
    while (!upstreamClosed && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    expect(upstreamClosed).toBe(true);
  });

  it('streams NDJSON chat deltas before the upstream response ends', async () => {
    let finish;
    const internalBaseUrl = await listen((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
      response.write('{"type":"delta","delta":"Hel"}\n');
      finish = () => response.end('{"type":"done"}\n');
    });
    const proxyUrl = await listen(createKernelProxyHandler({ internalBaseUrl }));
    const { body } = await readUntil(`${proxyUrl}/api/chat/stream`, '"delta":"Hel"');
    expect(body).toContain('"delta":"Hel"');
    finish?.();
  });

  it('keeps buffered JSON responses and mission-start detection unchanged', async () => {
    const started = [];
    const internalBaseUrl = await listen((request, response) => {
      request.resume();
      request.on('end', () => {
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, mission: { id: 'mission:1', status: 'queued' } }));
      });
    });
    const proxyUrl = await listen(createKernelProxyHandler({ internalBaseUrl, onMissionStart: (mission, token) => started.push([mission.id, token]) }));
    const response = await fetch(`${proxyUrl}/api/goals/goal%3A1/missions`, { method: 'POST', headers: { 'x-hephaestus-token': 't'.repeat(40), 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(201);
    expect((await response.json()).mission.id).toBe('mission:1');
    expect(started).toEqual([['mission:1', 't'.repeat(40)]]);
  });
});
