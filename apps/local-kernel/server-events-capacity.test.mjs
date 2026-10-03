import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

// /api/events wrote the 200 SSE head and then called kernelEvents.subscribe(), which throws
// EVENT_BUS_FULL at 16 subscribers. The throw escaped the async request handler (unhandled
// rejection: the client hung on a headless 200 and Node's default mode terminates the Kernel).
const apiToken = 'test-token-that-is-at-least-32-characters';
let server;
const open = [];
afterEach(async () => {
  for (const request of open.splice(0)) request.destroy();
  if (server?.listening) { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); }
});

function openStream(port) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/api/events', headers: { 'x-hephaestus-token': apiToken } }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      const done = () => resolve({ status: response.statusCode, type: String(response.headers['content-type'] ?? ''), body });
      response.on('data', (chunk) => { body += chunk; if (body.includes('\n\n')) done(); });
      response.on('end', done);
    });
    request.on('error', reject);
    request.setTimeout(3000, () => { request.destroy(); reject(new Error('stream timed out')); });
    open.push(request);
  });
}

describe('local Kernel /api/events capacity', () => {
  it('answers a clean 503 when the event bus is full, and frees the slot when a client leaves', async () => {
    server = createLocalKernelServer({}, undefined, undefined, undefined, { apiToken });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    for (let i = 0; i < 16; i += 1) {
      const stream = await openStream(port);
      expect(stream.status).toBe(200);
    }
    const rejected = await openStream(port);
    expect(rejected.status).toBe(503);
    expect(rejected.type).toContain('application/json');
    expect(JSON.parse(rejected.body).code).toBe('EVENT_STREAM_FULL');

    open.shift().destroy();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const again = await openStream(port);
    expect(again.status).toBe(200);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
  });
});
