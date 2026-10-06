import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { installDashboardBridge } from '../../../extension/src/dashboard-bridge.js';
import { discoverExtensionConnection, EXTENSION_TRANSPORT, kernelFetch, revokeExtensionConnection } from './extension-bridge';
import { KernelClient } from '../kernel/client';
const ORIGIN = 'https://efesto-five.vercel.app';
const ID = 'a'.repeat(32);
const TOKEN = 'private-fixture-kernel-token-'.repeat(2);
const cleanup = [];
function event() { const callbacks = []; return { addListener: (f) => callbacks.push(f), fire: (...args) => callbacks.forEach((f) => f(...args)) }; }
async function setup({ approve = true, offline = false } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ path: req.url, token: req.headers['x-hephaestus-token'] });
    if (req.headers['x-hephaestus-token'] !== TOKEN) { res.writeHead(401); res.end('{}'); return; }
    if (req.url === '/api/events') { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('event: ready\ndata: {}\n\n'); return; }
    if (req.url === '/api/chat/stream') { res.writeHead(200, { 'content-type': 'application/x-ndjson' }); res.end('{"type":"delta","delta":"hola"}\n{"type":"done"}\n'); return; }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true,"goals":[]}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  cleanup.push(() => { server.closeAllConnections(); server.close(); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const sender = { origin: ORIGIN, url: ORIGIN + '/', frameId: 0, tab: { id: 1 } };
  const store = { dashboardAutoConnect: approve, kernelBaseUrl: baseUrl, kernelApiToken: TOKEN };
  const chrome = { runtime: { onMessageExternal: event(), onConnectExternal: event() }, storage: { local: { get: async () => ({ ...store }), set: async (value) => { Object.assign(store, value); chrome.storage.onChanged.fire(Object.fromEntries(Object.entries(value).map(([k,v]) => [k,{newValue:v}])), 'local'); } }, onChanged: event() } };
  const outbound = [];
  installDashboardBridge(chrome, offline ? async () => { throw new Error('offline'); } : fetch);
  const windowEvents = new Map();
  const win = { location: { origin: ORIGIN }, addEventListener(type, fn) { windowEvents.set(type, fn); }, removeEventListener(type) { windowEvents.delete(type); }, postMessage(message) { queueMicrotask(() => windowEvents.get('message')?.({ source: win, origin: ORIGIN, data: { type: 'EFESTO_EXTENSION', nonce: message.nonce, extensionId: ID } })); } }; win.top = win;
  const api = {
    sendMessage(_id, message, callback) { chrome.runtime.onMessageExternal.fire(message, sender, (response) => { outbound.push(response); callback(response); }); },
    connect() {
      const pageMessage = event(); const workerMessage = event(); const closed = event(); let isClosed = false;
      const disconnect = () => { if (!isClosed) { isClosed = true; closed.fire(); } };
      const workerPort = { name: 'efesto.dashboard.v1', sender, onMessage: workerMessage, onDisconnect: closed, disconnect, postMessage: (message) => { outbound.push(message); queueMicrotask(() => pageMessage.fire(message)); } };
      chrome.runtime.onConnectExternal.fire(workerPort);
      return { onMessage: pageMessage, onDisconnect: closed, disconnect, postMessage: (message) => queueMicrotask(() => workerMessage.fire(message)) };
    },
  };
  vi.stubGlobal('window', win); vi.stubGlobal('chrome', { runtime: api });
  return { baseUrl, requests, outbound, store, chrome };
}
afterEach(async () => { await revokeExtensionConnection().catch(() => {}); cleanup.splice(0).forEach((f) => f()); vi.unstubAllGlobals(); });

describe('dashboard to extension to authenticated loopback transport', () => {
  it('reconnects with no page credential and reads a real loopback response', async () => {
    const f = await setup(); const connection = await discoverExtensionConnection();
    expect(connection).toEqual({ baseUrl: f.baseUrl, token: EXTENSION_TRANSPORT });
    const data = await new KernelClient(connection).get('/api/goals', (x) => x);
    expect(data).toEqual({ ok: true, goals: [] });
    expect(f.requests).toEqual([{ path: '/api/goals', token: TOKEN }]);
    expect(JSON.stringify(f.outbound)).not.toContain(TOKEN);
    await revokeExtensionConnection(); expect(f.store.dashboardAutoConnect).toBe(false);
    await expect(discoverExtensionConnection()).rejects.toThrow('PAIR_EXTENSION');
  });
  it('keeps streamed chat working and supports cancellation of event streams', async () => {
    await setup(); const connection = await discoverExtensionConnection(); const events = [];
    await new KernelClient(connection).streamNdjson('/api/chat/stream', { method: 'POST', body: '{}' }, (x) => events.push(x));
    expect(events).toEqual([{ type: 'delta', delta: 'hola' }, { type: 'done' }]);
    const controller = new AbortController();
    const response = await kernelFetch(connection.token)(connection.baseUrl + '/api/events', { signal: controller.signal });
    const reader = response.body.getReader(); expect((await reader.read()).done).toBe(false);
    controller.abort(); await expect(reader.read()).rejects.toThrow();
  });
  it('does not claim readiness when offline or unapproved', async () => {
    await setup({ offline: true }); const connection = await discoverExtensionConnection();
    await expect(new KernelClient(connection).get('/api/goals', (x) => x)).rejects.toMatchObject({ code: 'OFFLINE' });
    await revokeExtensionConnection(); await expect(discoverExtensionConnection()).rejects.toThrow('PAIR_EXTENSION');
  });
});
