import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

const token = 'p'.repeat(64);
const servers = new Set();
afterEach(async () => { for (const s of servers) await new Promise((r) => s.close(r)); servers.clear(); });

async function start(options = {}) {
  const server = createLocalKernelServer({ accept: vi.fn() }, undefined, undefined, undefined, { apiToken: token, allowedDashboardOrigins: [], ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  return `http://127.0.0.1:${server.address().port}`;
}
const mint = (base, headers = {}) => fetch(`${base}/api/pairing/extension-code`, { method: 'POST', headers: { 'x-hephaestus-token': token, ...headers } });
const pair = (base, code, origin = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop') => fetch(`${base}/pair`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ code }) });

describe('owner-issued extension pairing code (auto-pair)', () => {
  it('requires the Kernel token', async () => {
    const base = await start();
    const res = await fetch(`${base}/api/pairing/extension-code`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('mints a one-use code that the extension can redeem exactly once', async () => {
    const base = await start();
    const res = await mint(base);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{8}$/);
    expect(Date.parse(body.expiresAt) - Date.now()).toBeLessThanOrEqual(120_000);
    expect(JSON.stringify(body)).not.toContain(token);
    const first = await pair(base, body.code);
    expect(first.status).toBe(200);
    expect((await first.json()).apiToken).toBe(token);
    expect((await pair(base, body.code)).status).toBe(410);
  });

  it('a new mint replaces the previous code', async () => {
    const base = await start();
    const a = (await (await mint(base)).json()).code;
    const b = (await (await mint(base)).json()).code;
    expect((await pair(base, a)).status).toBe(401);
    expect((await pair(base, b)).status).toBe(200);
  });

  it('refuses to mint for an extension origin', async () => {
    const base = await start();
    expect((await mint(base, { origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop' })).status).toBe(403);
  });

  it('rate-limits minting', async () => {
    const base = await start();
    for (let i = 0; i < 20; i += 1) expect((await mint(base)).status).toBe(200);
    expect((await mint(base)).status).toBe(429);
  });
});
