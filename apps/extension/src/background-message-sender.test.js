import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EXT_ID = 'efestoextensionid';
const REAL_TOKEN = 'k'.repeat(40);
const POPUP = { id: EXT_ID, url: `chrome-extension://${EXT_ID}/src/popup.html`, origin: `chrome-extension://${EXT_ID}` };
// Content scripts run inside every http(s) page renderer; Chrome treats their messages as less trusted.
const CONTENT_SCRIPT = { id: EXT_ID, url: 'https://attacker.example/page', origin: 'https://attacker.example', tab: { id: 7, url: 'https://attacker.example/page' }, frameId: 0 };

function installChrome() {
  const store = { kernelBaseUrl: 'http://127.0.0.1:4317', kernelApiToken: REAL_TOKEN };
  let listener;
  const noopEvent = { addListener: () => {} };
  globalThis.chrome = {
    runtime: { id: EXT_ID, onMessage: { addListener: (fn) => { listener = fn; } }, onInstalled: noopEvent, onStartup: noopEvent, sendMessage: vi.fn(async () => undefined), getURL: (p) => `chrome-extension://${EXT_ID}/${p}` },
    storage: {
      local: {
        get: vi.fn(async (keys) => {
          const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(store);
          return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, store[k]]));
        }),
        set: vi.fn(async (items) => { Object.assign(store, items); }),
        setAccessLevel: vi.fn(async () => undefined),
      },
      onChanged: noopEvent,
    },
    alarms: { create: vi.fn(async () => undefined), onAlarm: noopEvent, clear: vi.fn(async () => true) },
    notifications: { create: vi.fn(), clear: vi.fn(), onClicked: noopEvent },
    action: { setTitle: vi.fn(async () => undefined), openPopup: vi.fn(async () => undefined), setBadgeText: vi.fn(async () => undefined), setBadgeBackgroundColor: vi.fn(async () => undefined) },
    tabs: { sendMessage: vi.fn(async () => ({ ok: false })), query: vi.fn(async () => []), onUpdated: noopEvent, onActivated: noopEvent },
  };
  globalThis.fetch = vi.fn(async () => { throw new Error('offline'); });
  return { store, dispatch: (message, sender) => new Promise((resolve) => {
    const keepOpen = listener(message, sender, resolve);
    if (!keepOpen) resolve(undefined);
  }) };
}

describe('extension background rejects privileged messages from content-script senders', () => {
  let env;
  beforeEach(async () => {
    vi.resetModules();
    env = installChrome();
    await import('./background.js');
    await new Promise((r) => setTimeout(r, 0));
  });
  afterEach(() => { delete globalThis.chrome; vi.restoreAllMocks(); });

  it('does not let a content-script sender rewrite the Kernel URL or token', async () => {
    const response = await env.dispatch({ type: 'EFESTO_AUTO_RADAR_UPDATE_CONFIG', kernelBaseUrl: 'https://attacker.example', kernelApiToken: 'attacker' }, CONTENT_SCRIPT);
    await new Promise((r) => setTimeout(r, 0));
    expect(response?.ok).not.toBe(true);
    expect(env.store.kernelBaseUrl).toBe('http://127.0.0.1:4317');
    expect(env.store.kernelApiToken).toBe(REAL_TOKEN);
  });

  it('does not leak Auto Radar state or toggle it for a content-script sender', async () => {
    const state = await env.dispatch({ type: 'EFESTO_AUTO_RADAR_GET_STATE' }, CONTENT_SCRIPT);
    expect(state?.kernelBaseUrl).toBeUndefined();
    expect(state?.allowedOrigins).toBeUndefined();
    const toggled = await env.dispatch({ type: 'EFESTO_AUTO_RADAR_TOGGLE' }, CONTENT_SCRIPT);
    expect(toggled?.ok).not.toBe(true);
  });

  it('does not forward content-script-supplied page context to the Kernel', async () => {
    const result = await env.dispatch({ type: 'HEPHAESTUS_SEND_PAGE_CONTEXT', context: { schemaVersion: 'hephaestus.page-context.v1', url: 'https://attacker.example', title: 'x', text: 'x' } }, CONTENT_SCRIPT);
    expect(result?.ok).not.toBe(true);
    const pageContextCalls = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/api/browser/page-context'));
    expect(pageContextCalls).toHaveLength(0);
  });

  it('still accepts page-ready from the content script (auto-capture path)', async () => {
    await env.dispatch({ type: 'EFESTO_PUBLIC_PAGE_READY' }, CONTENT_SCRIPT);
    await new Promise((r) => setTimeout(r, 0));
    expect(globalThis.chrome.storage.local.get).toHaveBeenCalledWith(expect.arrayContaining(['radarEnabled', 'allowedOrigins']));
  });

  it('restricts storage.local (Kernel token) to trusted contexts on startup', () => {
    expect(globalThis.chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });

  it('still serves the popup (extension page) for toggle', async () => {
    const toggled = await env.dispatch({ type: 'EFESTO_AUTO_RADAR_TOGGLE' }, POPUP);
    expect(toggled?.ok).toBe(true);
  });
});

describe('runtime message sender policy (pure)', async () => {
  const { runtimeMessageDecision, isExtensionPageSender, isContentScriptSender } = await import('./runtime-message-policy.js');

  it('allows privileged commands only from this extension page', () => {
    for (const type of ['EFESTO_AUTO_RADAR_TOGGLE', 'EFESTO_AUTO_RADAR_GET_STATE', 'EFESTO_AUTO_RADAR_SET_STATE', 'EFESTO_AUTO_RADAR_UPDATE_CONFIG', 'HEPHAESTUS_SEND_PAGE_CONTEXT']) {
      expect(runtimeMessageDecision({ type }, POPUP, EXT_ID), type).toBe('allow');
      expect(runtimeMessageDecision({ type }, CONTENT_SCRIPT, EXT_ID), type).toBe('deny');
      expect(runtimeMessageDecision({ type }, { ...POPUP, id: 'other-extension', url: 'chrome-extension://other-extension/x.html' }, EXT_ID), type).toBe('deny');
      expect(runtimeMessageDecision({ type }, { id: EXT_ID, url: 'chrome-extension://other/x.html' }, EXT_ID), type).toBe('deny');
      expect(runtimeMessageDecision({ type }, undefined, EXT_ID), type).toBe('deny');
    }
  });

  it('accepts page-ready only from a content-script tab sender', () => {
    expect(runtimeMessageDecision({ type: 'EFESTO_PUBLIC_PAGE_READY' }, CONTENT_SCRIPT, EXT_ID)).toBe('allow');
    expect(runtimeMessageDecision({ type: 'EFESTO_PUBLIC_PAGE_READY' }, POPUP, EXT_ID)).toBe('deny');
    expect(runtimeMessageDecision({ type: 'EFESTO_PUBLIC_PAGE_READY' }, { ...CONTENT_SCRIPT, id: 'other' }, EXT_ID)).toBe('deny');
  });

  it('ignores unknown message types and fails closed without a runtime id', () => {
    expect(runtimeMessageDecision({ type: 'SOMETHING_ELSE' }, POPUP, EXT_ID)).toBe('ignore');
    expect(runtimeMessageDecision(undefined, POPUP, EXT_ID)).toBe('ignore');
    expect(isExtensionPageSender(POPUP, undefined)).toBe(false);
    expect(isContentScriptSender(CONTENT_SCRIPT, '')).toBe(false);
  });
});
