import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EXT_ID = 'efestoextensionid';
const TOKEN = 'k'.repeat(40);
const WATCHTOWER_ALARM = 'efesto-mission-watchtower';

function installChrome({ existingAlarm } = {}) {
  const store = { kernelBaseUrl: 'http://127.0.0.1:4317', kernelApiToken: TOKEN };
  const listeners = { alarm: [], startup: [], installed: [] };
  const noopEvent = { addListener: () => {} };
  const pending = [];
  globalThis.fetch = vi.fn((url) => new Promise((resolve) => {
    pending.push(() => resolve(new Response(JSON.stringify(String(url).includes('agent-missions') ? { ok: true, missions: [] } : { ok: true, opportunities: [], notifications: [] }), { status: 200, headers: { 'content-type': 'application/json' } })));
  }));
  globalThis.chrome = {
    runtime: { id: EXT_ID, onMessage: noopEvent, onInstalled: { addListener: (fn) => listeners.installed.push(fn) }, onStartup: { addListener: (fn) => listeners.startup.push(fn) }, sendMessage: vi.fn(async () => undefined) },
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
    alarms: {
      create: vi.fn(async () => undefined),
      get: vi.fn(async (name) => (existingAlarm && name === WATCHTOWER_ALARM ? { name, periodInMinutes: 1, scheduledTime: Date.now() + 30_000 } : undefined)),
      onAlarm: { addListener: (fn) => listeners.alarm.push(fn) },
      clear: vi.fn(async () => true),
    },
    notifications: { create: vi.fn(), clear: vi.fn(), onClicked: noopEvent },
    action: { setTitle: vi.fn(async () => undefined), openPopup: vi.fn(async () => undefined), setBadgeText: vi.fn(async () => undefined), setBadgeBackgroundColor: vi.fn(async () => undefined) },
    tabs: { sendMessage: vi.fn(async () => ({ ok: false })), query: vi.fn(async () => []), onUpdated: noopEvent, onActivated: noopEvent },
  };
  return { listeners, pending };
}

const missionListCalls = () => globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/api/agent-missions')).length;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('extension watchtower inspection is single-flight', () => {
  afterEach(() => { delete globalThis.chrome; vi.restoreAllMocks(); });

  it('an alarm wake during the startup inspection does not start a second overlapping inspection', async () => {
    vi.resetModules();
    const env = installChrome();
    await import('./background.js');
    await settle(); await settle();
    // Service worker woke for the alarm: top-level ensureWatchtower already inspecting.
    for (const fn of env.listeners.alarm) void fn({ name: WATCHTOWER_ALARM });
    for (const fn of env.listeners.startup) fn();
    await settle(); await settle();
    expect(missionListCalls()).toBe(1);
    // After it settles, the next alarm tick inspects again.
    for (let round = 0; round < 20; round += 1) {
      while (env.pending.length) env.pending.shift()();
      await settle();
    }
    for (const fn of env.listeners.alarm) void fn({ name: WATCHTOWER_ALARM });
    await settle(); await settle();
    expect(missionListCalls()).toBe(2);
  });

  it('does not re-arm (reset) an existing watchtower alarm on every service-worker start', async () => {
    vi.resetModules();
    installChrome({ existingAlarm: true });
    await import('./background.js');
    await settle(); await settle();
    expect(globalThis.chrome.alarms.get).toHaveBeenCalledWith(WATCHTOWER_ALARM);
    expect(globalThis.chrome.alarms.create).not.toHaveBeenCalled();
  });

  it('creates the watchtower alarm when it is missing', async () => {
    vi.resetModules();
    installChrome({ existingAlarm: false });
    await import('./background.js');
    await settle(); await settle();
    expect(globalThis.chrome.alarms.create).toHaveBeenCalledWith(WATCHTOWER_ALARM, { periodInMinutes: 1 });
  });
});
