import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTO_CAPTURE_COOLDOWN_MS } from './auto-capture-policy.js';

const EXT_ID = 'efestoextensionid';
const ORIGIN = 'https://example.org';

function installChrome(initial) {
  const store = { kernelBaseUrl: 'http://127.0.0.1:4317', kernelApiToken: 'k'.repeat(40), radarEnabled: true, allowedOrigins: [ORIGIN], ...initial };
  const listeners = { message: [] };
  const noopEvent = { addListener: () => {} };
  let tabUrl = `${ORIGIN}/article`;
  globalThis.fetch = vi.fn(async (url) => new Response(JSON.stringify(String(url).includes('agent-missions') ? { ok: true, missions: [] } : { ok: true, opportunities: [], notifications: [], receiptId: 'r1', caseId: 'c1', evidenceId: 'e1' }), { status: 200, headers: { 'content-type': 'application/json' } }));
  globalThis.chrome = {
    runtime: { id: EXT_ID, onMessage: { addListener: (fn) => listeners.message.push(fn) }, onInstalled: noopEvent, onStartup: noopEvent, sendMessage: vi.fn(async () => undefined) },
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(store);
          return structuredClone(Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]])));
        }),
        set: vi.fn(async (items) => { Object.assign(store, structuredClone(items)); }),
        setAccessLevel: vi.fn(async () => undefined),
      },
      onChanged: noopEvent,
    },
    alarms: { create: vi.fn(async () => undefined), get: vi.fn(async () => ({ name: 'x' })), onAlarm: noopEvent, clear: vi.fn(async () => true) },
    notifications: { create: vi.fn(), clear: vi.fn(), onClicked: noopEvent },
    action: { setTitle: vi.fn(async () => undefined), openPopup: vi.fn(async () => undefined), setBadgeText: vi.fn(async () => undefined), setBadgeBackgroundColor: vi.fn(async () => undefined) },
    tabs: {
      sendMessage: vi.fn(async () => ({ ok: true, context: { schemaVersion: 'hephaestus.page-context.v1', url: tabUrl, title: 'Article', visibleText: 'Public article text', capturedAt: new Date().toISOString() } })),
      query: vi.fn(async () => []), onUpdated: noopEvent, onActivated: noopEvent,
    },
  };
  return { store, listeners, setTabUrl: (u) => { tabUrl = u; } };
}

const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0)); };
const pageReady = (env) => { for (const fn of env.listeners.message) fn({ type: 'EFESTO_PUBLIC_PAGE_READY' }, { id: EXT_ID, tab: { id: 7, url: `${ORIGIN}/article` } }, () => {}); };
const pageContextPosts = () => globalThis.fetch.mock.calls.filter(([url, init]) => String(url).includes('/api/browser/page-context') && init?.method === 'POST').length;

describe('manual Site Radar auto-capture memory', () => {
  afterEach(() => { delete globalThis.chrome; vi.restoreAllMocks(); });

  it('drops cooldown-expired URLs instead of persisting every visited URL forever', async () => {
    vi.resetModules();
    const stale = Date.now() - AUTO_CAPTURE_COOLDOWN_MS - 60_000;
    const previous = Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`${ORIGIN}/old-${i}`, stale]));
    const env = installChrome({ lastAutoCaptureByUrl: previous });
    await import('./background.js');
    await settle();
    pageReady(env);
    await settle();
    expect(pageContextPosts()).toBe(1);
    expect(Object.keys(env.store.lastAutoCaptureByUrl)).toEqual([`${ORIGIN}/article`]);
  });

  it('a #fragment change on the same page does not bypass the cooldown', async () => {
    vi.resetModules();
    const env = installChrome();
    await import('./background.js');
    await settle();
    pageReady(env);
    await settle();
    env.setTabUrl(`${ORIGIN}/article#section-2`);
    pageReady(env);
    await settle();
    expect(pageContextPosts()).toBe(1);
  });
});
