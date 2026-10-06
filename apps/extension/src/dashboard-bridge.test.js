import { afterEach, describe, it, expect, vi } from 'vitest';
import { approvedDashboardSender, bridgeRequestAllowed, bridgeBaseUrl, installDashboardBridge, BRIDGE_NAME } from './dashboard-bridge.js';
const sender = { origin: 'https://efesto-five.vercel.app', url: 'https://efesto-five.vercel.app/', frameId: 0, tab: { id: 1 } };
const cleanup = [];
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
const token = 'test-only-kernel-token-'.repeat(3);
function event() { const callbacks = []; return { addListener: (fn) => callbacks.push(fn), fire: (...args) => callbacks.forEach((fn) => fn(...args)) }; }
function fixture(fetcher = vi.fn(async () => new Response('{"ok":true}'))) {
  const stored = { dashboardAutoConnect: true, kernelApiToken: token };
  const chrome = { runtime: { onMessageExternal: event(), onConnectExternal: event() }, storage: { local: { get: vi.fn(async () => ({ ...stored })), set: vi.fn(async (value) => Object.assign(stored, value)) }, onChanged: event() } };
  installDashboardBridge(chrome, fetcher);
  const port = { name: BRIDGE_NAME, sender, onMessage: event(), onDisconnect: event(), postMessage: vi.fn(), disconnect: vi.fn() };
  cleanup.push(() => port.onDisconnect.fire());
  return { chrome, stored, port, fetcher };
}
async function settle() { for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0)); }

describe('authorized dashboard extension bridge', () => {
  it('requires the exact top-level production origin and a browser tab, not another extension', () => {
    expect(approvedDashboardSender(sender)).toBe(true);
    for (const change of [{ origin: 'null' }, { origin: 'https://evil.example' }, { url: 'https://efesto-five.vercel.app.evil.example/' }, { frameId: 1 }, { tab: undefined }, { id: 'other-extension' }, { tab: { id: 1, incognito: true } }]) expect(approvedDashboardSender({ ...sender, ...change })).toBe(false);
  });
  it('permits only product operations, rejecting worker authority, arbitrary URLs and oversized bodies', () => {
    for (const path of ['/health', '/api/events', '/api/browser/case/case%3A123', '/api/agent-missions/m1/evidence']) expect(bridgeRequestAllowed({ path })).toBe(true);
    for (const path of ['/api/goals/g1/missions', '/api/goals/g1/revisions', '/api/chat/stream']) expect(bridgeRequestAllowed({ path, method: 'POST', body: '{}' })).toBe(true);
    for (const path of ['//evil.test/api/goals', '/api/../pair', '/api/agents/hermes/ping', '/api/agent-missions/claim', '/api/goals/%2e%2e', '/pair', '/hermes/ingestions']) expect(bridgeRequestAllowed({ path, method: 'POST', body: '{}' })).toBe(false);
    expect(bridgeRequestAllowed({ path: '/api/goals', method: 'POST', body: 'x'.repeat(1_048_577) })).toBe(false);
    expect(() => bridgeBaseUrl('https://evil.test')).toThrow();
    expect(() => bridgeBaseUrl('http://localhost:4000/?token=x')).toThrow();
  });
  it('never returns the token during discovery and requires saved consent', async () => {
    const f = fixture(); const response = vi.fn();
    f.chrome.runtime.onMessageExternal.fire({ type: 'EFESTO_CONNECTION' }, sender, response); await settle();
    expect(response).toHaveBeenLastCalledWith({ ok: true, baseUrl: 'http://127.0.0.1:4000' });
    expect(JSON.stringify(response.mock.calls)).not.toContain(token);
    f.stored.dashboardAutoConnect = false;
    f.chrome.runtime.onMessageExternal.fire({ type: 'EFESTO_CONNECTION' }, sender, response); await settle();
    expect(response).toHaveBeenLastCalledWith({ ok: false, code: 'PAIR_EXTENSION' });
  });
  it('streams authenticated loopback results without passing secrets to the page', async () => {
    const f = fixture(); f.chrome.runtime.onConnectExternal.fire(f.port);
    f.port.onMessage.fire({ path: '/api/goals', method: 'GET', headers: { authorization: 'attacker' }, baseUrl: 'https://evil.test' }); await settle();
    expect(f.fetcher).toHaveBeenCalledWith('http://127.0.0.1:4000/api/goals', expect.objectContaining({ redirect: 'error', credentials: 'omit', headers: { accept: 'application/json', 'x-hephaestus-token': token } }));
    expect(f.port.postMessage.mock.calls.map(([m]) => m.type)).toEqual(['headers', 'chunk', 'done']);
    expect(JSON.stringify(f.port.postMessage.mock.calls)).not.toContain(token);
  });
  it('blocks missing consent and foreign senders before network work', async () => {
    const f = fixture(); f.stored.dashboardAutoConnect = false;
    f.chrome.runtime.onConnectExternal.fire(f.port); f.port.onMessage.fire({ path: '/api/goals' }); await settle();
    expect(f.fetcher).not.toHaveBeenCalled();
    const other = fixture(); other.port.sender = { ...sender, origin: 'https://evil.test' };
    other.chrome.runtime.onConnectExternal.fire(other.port); expect(other.port.disconnect).toHaveBeenCalled();
    expect(other.chrome.storage.local.get).not.toHaveBeenCalled();
  });
  it('aborts active network work when consent is revoked or the page closes', async () => {
    const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('abort')))));
    const f = fixture(fetcher); f.chrome.runtime.onConnectExternal.fire(f.port); f.port.onMessage.fire({ path: '/api/events' }); await settle();
    f.chrome.storage.onChanged.fire({ dashboardAutoConnect: { newValue: false } }, 'local'); await settle();
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true); expect(f.port.disconnect).toHaveBeenCalled();
    expect(f.port.postMessage).not.toHaveBeenCalled();
  });
  it('does not leak fetch exceptions and revokes stored consent on disconnect', async () => {
    const f = fixture(vi.fn(async () => { throw new Error(token); }));
    f.chrome.runtime.onConnectExternal.fire(f.port); f.port.onMessage.fire({ path: '/api/goals' }); await settle();
    expect(f.port.postMessage).toHaveBeenCalledWith({ type: 'error', code: 'BRIDGE_UNAVAILABLE' });
    const response = vi.fn(); f.chrome.runtime.onMessageExternal.fire({ type: 'EFESTO_FORGET' }, sender, response); await settle();
    expect(f.stored.dashboardAutoConnect).toBe(false); expect(JSON.stringify(f.port.postMessage.mock.calls)).not.toContain(token);
  });
});
