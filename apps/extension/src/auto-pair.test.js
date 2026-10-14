import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installAutoPair, isDashboardContentSender, loopbackKernelOrigin, redeemDashboardCode, validPairingCode, ensureDashboardOpen } from './auto-pair.js';

const ID = 'abcdefghijklmnopabcdefghijklmnop';
const dashSender = { id: ID, frameId: 0, url: 'http://127.0.0.1:3311/', tab: { id: 7, incognito: false } };

function chromeMock(stored = {}) {
  const listeners = [];
  const data = { ...stored };
  return {
    data, listeners,
    runtime: { id: ID, onMessage: { addListener: (fn) => listeners.push(fn) } },
    storage: { local: { get: vi.fn(async () => ({ ...data })), set: vi.fn(async (v) => Object.assign(data, v)) } },
    tabs: { query: vi.fn(async () => []), create: vi.fn(async () => ({})), reload: vi.fn(async () => undefined) },
  };
}
const send = (api, message, sender) => new Promise((resolve) => { const r = api.listeners[0](message, sender, resolve); if (r === false) setTimeout(() => resolve(undefined), 0); });

describe('auto-pair sender and input gates', () => {
  it('accepts only our content script in the top frame of the local dashboard', () => {
    expect(isDashboardContentSender(dashSender, ID)).toBe(true);
    expect(isDashboardContentSender({ ...dashSender, url: 'http://localhost:3311/x' }, ID)).toBe(true);
    expect(isDashboardContentSender({ ...dashSender, url: 'https://evil.example/' }, ID)).toBe(false);
    expect(isDashboardContentSender({ ...dashSender, url: 'http://127.0.0.1:4310/' }, ID)).toBe(false);
    expect(isDashboardContentSender({ ...dashSender, frameId: 3 }, ID)).toBe(false);
    expect(isDashboardContentSender({ ...dashSender, id: 'other' }, ID)).toBe(false);
    expect(isDashboardContentSender({ ...dashSender, tab: { id: 7, incognito: true } }, ID)).toBe(false);
  });

  it('only loopback http Kernels and well-formed codes', () => {
    expect(loopbackKernelOrigin('http://127.0.0.1:4310/x')).toBe('http://127.0.0.1:4310');
    expect(loopbackKernelOrigin('https://127.0.0.1:4310')).toBeUndefined();
    expect(loopbackKernelOrigin('http://evil.example:4310')).toBeUndefined();
    expect(loopbackKernelOrigin('http://user:pw@127.0.0.1:4310')).toBeUndefined();
    expect(validPairingCode('ABCD2345')).toBe(true);
    expect(validPairingCode('abcd2345')).toBe(false);
    expect(validPairingCode('ABCD0123')).toBe(false);
  });
});

describe('redeeming a dashboard-issued code', () => {
  it('pairs at the loopback Kernel and stores token + base URL', async () => {
    const api = chromeMock();
    const pairKernel = vi.fn(async () => 'k'.repeat(64));
    await expect(redeemDashboardCode({ code: 'ABCD2345', kernelUrl: 'http://127.0.0.1:4310' }, api, { pairKernel })).resolves.toEqual({ ok: true, baseUrl: 'http://127.0.0.1:4310' });
    expect(pairKernel).toHaveBeenCalledWith('ABCD2345', expect.objectContaining({ baseUrl: 'http://127.0.0.1:4310' }));
    expect(api.data).toEqual({ kernelApiToken: 'k'.repeat(64), kernelBaseUrl: 'http://127.0.0.1:4310' });
  });

  it('refuses a non-loopback Kernel without calling it', async () => {
    const api = chromeMock();
    const pairKernel = vi.fn();
    await expect(redeemDashboardCode({ code: 'ABCD2345', kernelUrl: 'http://evil.example' }, api, { pairKernel })).rejects.toMatchObject({ code: 'NON_LOOPBACK_KERNEL' });
    expect(pairKernel).not.toHaveBeenCalled();
  });
});

describe('background router', () => {
  it('rejects codes from any page that is not the local dashboard', async () => {
    const api = chromeMock(); const pairKernel = vi.fn(async () => 'k'.repeat(64));
    installAutoPair(api, { pairKernel });
    await expect(send(api, { type: 'EFESTO_PAIR_WITH_CODE', code: 'ABCD2345', kernelUrl: 'http://127.0.0.1:4310' }, { ...dashSender, url: 'https://evil.example/' })).resolves.toMatchObject({ ok: false, code: 'FORBIDDEN_SENDER' });
    expect(pairKernel).not.toHaveBeenCalled();
    await expect(send(api, { type: 'EFESTO_PAIR_WITH_CODE', code: 'ABCD2345', kernelUrl: 'http://127.0.0.1:4310' }, dashSender)).resolves.toMatchObject({ ok: true });
  });

  it('reports pairing need only to the dashboard script; start only from extension pages', async () => {
    const api = chromeMock(); installAutoPair(api);
    await expect(send(api, { type: 'EFESTO_AUTO_PAIR_STATUS' }, dashSender)).resolves.toEqual({ ok: true, needsPairing: true });
    await expect(send(api, { type: 'EFESTO_AUTO_PAIR_START' }, dashSender)).resolves.toMatchObject({ ok: false });
    await expect(send(api, { type: 'EFESTO_AUTO_PAIR_START' }, { id: ID, url: `chrome-extension://${ID}/src/popup-v2.html` })).resolves.toMatchObject({ ok: true, opened: true });
    expect(api.tabs.create).toHaveBeenCalledWith({ url: 'http://127.0.0.1:3311/', active: false });
  });

  it('reuses an already open dashboard tab', async () => {
    const api = chromeMock(); api.tabs.query = vi.fn(async () => [{ id: 4 }]);
    await expect(ensureDashboardOpen(api)).resolves.toEqual({ opened: false });
    expect(api.tabs.create).not.toHaveBeenCalled();
  });
});

describe('manifest wiring', () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../manifest.json', import.meta.url)), 'utf8'));
  it('injects the pair bridge only on the local dashboard and uses the v2 popup', () => {
    const bridge = manifest.content_scripts.find((c) => c.js.includes('src/dashboard-pair-bridge.js'));
    expect(bridge.matches).toEqual(['http://127.0.0.1:3311/*', 'http://localhost:3311/*']);
    expect(bridge.all_frames).toBe(false);
    expect(manifest.action.default_popup).toBe('src/popup-v2.html');
  });
});
