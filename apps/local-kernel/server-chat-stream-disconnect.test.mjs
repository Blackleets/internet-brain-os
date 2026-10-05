import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

// writeStreamEvent awaited only 'drain'. A client that disconnects while the socket is
// backpressured never emits 'drain', so the chat stream handler (and chat.stream's onDelta)
// stayed pending forever: one leaked request/closure per dropped slow client.
const apiToken = 'test-token-that-is-at-least-32-characters';
let server;
afterEach(async () => {
  if (server?.listening) { server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); }
});

describe('local Kernel /api/chat/stream client disconnect', () => {
  it('settles the stream when a backpressured client goes away', async () => {
    let settled = false;
    let started;
    const startedPromise = new Promise((resolve) => { started = resolve; });
    const chatService = {
      async stream(_input, { onDelta, signal }) {
        try {
          started();
          for (let i = 0; i < 64 && !signal.aborted; i += 1) await onDelta('x'.repeat(1 << 20));
          return { providerId: 'p', model: 'm', content: 'done' };
        } finally { settled = true; }
      },
    };
    const chatConversationStore = {
      get: async () => undefined,
      create: async () => ({ id: 'conversation:1' }),
      appendExchange: async () => undefined,
      list: async () => [],
    };
    server = createLocalKernelServer({}, undefined, undefined, undefined, { apiToken, chatService, chatConversationStore });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const request = http.request({ host: '127.0.0.1', port, path: '/api/chat/stream', method: 'POST', headers: { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' } }, (response) => {
      response.pause(); // never read: server-side writes hit backpressure
    });
    request.on('error', () => {});
    request.end(JSON.stringify({ providerId: 'p', model: 'm', messages: [{ role: 'user', content: 'hi' }] }));
    await startedPromise;
    await new Promise((resolve) => setTimeout(resolve, 300));
    request.destroy();
    const deadline = Date.now() + 3000;
    while (!settled && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
    expect(settled).toBe(true);
  });
});
