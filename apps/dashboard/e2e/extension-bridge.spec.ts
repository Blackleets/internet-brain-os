import { chromium, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test('real Chromium extension messaging requires consent, streams authenticated reads and revokes', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'efesto-extension-browser-'));
  const extension = resolve(__dirname, '../../extension');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await context.route('https://efesto-five.vercel.app/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Efesto bridge acceptance fixture</title>',
    }));
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    // Synthetic test credential goes directly into trusted extension storage, never through the page.
    await worker.evaluate(async () => {
      await (globalThis as any).chrome.storage.local.set({
        kernelBaseUrl: 'http://127.0.0.1:4100',
        kernelApiToken: 'test-token-that-is-long-enough-for-kernel-validation',
        dashboardAutoConnect: false,
      });
    });
    const page = await context.newPage();
    await page.goto('https://efesto-five.vercel.app/');
    const discovered = await page.evaluate(() => new Promise<string>(resolve => {
      const nonce = crypto.randomUUID();
      const timer = setTimeout(() => resolve(''), 2500);
      const receive = (event: MessageEvent) => {
        if (event.source === window && event.data?.type === 'EFESTO_EXTENSION' && event.data.nonce === nonce) {
          clearTimeout(timer); window.removeEventListener('message', receive); resolve(event.data.extensionId);
        }
      };
      window.addEventListener('message', receive);
      window.postMessage({ type: 'EFESTO_DISCOVER', nonce }, window.location.origin);
    }));
    expect(discovered).toBe(id);
    const message = (type: string) => page.evaluate(({ id, type }) => new Promise<Record<string, unknown>>(resolve => {
      (globalThis as any).chrome.runtime.sendMessage(id, { type }, (result: Record<string, unknown>) => {
        void (globalThis as any).chrome.runtime.lastError;
        resolve(result ?? { ok: false });
      });
    }), { id, type });
    expect(await message('EFESTO_CONNECTION')).toEqual({ ok: false, code: 'PAIR_EXTENSION' });
    await worker.evaluate(async () => { await (globalThis as any).chrome.storage.local.set({ dashboardAutoConnect: true }); });
    expect(await message('EFESTO_CONNECTION')).toEqual({ ok: true, baseUrl: 'http://127.0.0.1:4100' });
    const response = await page.evaluate(id => new Promise<{ status: number; text: string }>((resolve, reject) => {
      const port = (globalThis as any).chrome.runtime.connect(id, { name: 'efesto.dashboard.v1' });
      let status = 0;
      const bytes: number[] = [];
      port.onMessage.addListener((message: any) => {
        if (message.type === 'headers') status = message.status;
        else if (message.type === 'chunk') bytes.push(...message.bytes);
        else if (message.type === 'done') { resolve({ status, text: new TextDecoder().decode(new Uint8Array(bytes)) }); port.disconnect(); }
        else { reject(new Error('Bridge denied')); port.disconnect(); }
      });
      port.onDisconnect.addListener(() => { void (globalThis as any).chrome.runtime.lastError; });
      port.postMessage({ path: '/api/goals', method: 'GET' });
    }), id);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text).goals[0].id).toBe('goal-1');
    expect(response.text).not.toContain('test-token-that-is-long-enough-for-kernel-validation');
    await page.reload();
    expect((await message('EFESTO_CONNECTION')).ok).toBe(true);
    expect(await message('EFESTO_FORGET')).toEqual({ ok: true });
    await page.reload();
    expect((await message('EFESTO_CONNECTION')).ok).toBe(false);
    await context.route('https://unapproved.example/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Unapproved</title>' }));
    await page.goto('https://unapproved.example/');
    expect(await page.evaluate(() => Boolean((globalThis as any).chrome?.runtime?.sendMessage))).toBe(false);
  } finally { await context.close(); await rm(profile, { recursive: true, force: true }); }
});
