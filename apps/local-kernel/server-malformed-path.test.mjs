import { afterEach, describe, expect, it } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

// Malformed percent-encoding in a path id made decodeURIComponent throw URIError outside the
// route's try block: the async request handler rejected, the client never got a response and
// Node's default unhandled-rejection mode terminates the Kernel process.
const apiToken = 'test-token-that-is-at-least-32-characters';
let server;
afterEach(async () => { if (server?.listening) await new Promise((resolve) => server.close(resolve)); });

async function start(options) {
  server = createLocalKernelServer({}, options.projector, undefined, undefined, { apiToken, ...options.extra });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

describe('local Kernel path ids with malformed percent-encoding', () => {
  it('answers 400 on /api/browser/case/:id instead of rejecting the handler', async () => {
    const base = await start({ projector: { listCases: async () => [], getCaseById: async () => ({}) } });
    const response = await fetch(`${base}/api/browser/case/%E0%A4%A`, { headers: { 'x-hephaestus-token': apiToken }, signal: AbortSignal.timeout(3000) });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_PATH');
  });

  it('answers 400 on /api/chat/conversations/:id instead of rejecting the handler', async () => {
    const conversations = { get: async () => ({}), remove: async () => undefined, list: async () => [] };
    const base = await start({ extra: { chatConversationStore: conversations } });
    for (const method of ['GET', 'DELETE']) {
      const response = await fetch(`${base}/api/chat/conversations/%ZZ`, { method, headers: { 'x-hephaestus-token': apiToken }, signal: AbortSignal.timeout(3000) });
      expect(response.status, method).toBe(400);
    }
  });

  it('answers 400 (not 500) on other id routes such as /api/goal-surfaces/:id', async () => {
    const base = await start({ extra: { goalSurfaceReader: { list: async () => [], get: async () => ({}) } } });
    const response = await fetch(`${base}/api/goal-surfaces/%E0%A4%A`, { headers: { 'x-hephaestus-token': apiToken }, signal: AbortSignal.timeout(3000) });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_PATH');
  });

  it('keeps well-formed ids working', async () => {
    const seen = [];
    const base = await start({ projector: { listCases: async () => [], getCaseById: async (id) => { seen.push(id); return { case: { id } }; } } });
    const response = await fetch(`${base}/api/browser/case/case%3A1`, { headers: { 'x-hephaestus-token': apiToken } });
    expect(response.status).toBe(200);
    expect(seen).toEqual(['case:1']);
  });
});
