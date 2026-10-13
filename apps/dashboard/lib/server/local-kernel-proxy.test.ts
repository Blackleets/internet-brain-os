import { describe, expect, it } from 'vitest';
import { checkLocalRequest, kernelPathFrom, localKernelUrl, localStatus, proxyToLocalKernel } from './local-kernel-proxy';

const TOKEN = 'k'.repeat(48);
const env = { EFESTO_LOCAL_KERNEL_TOKEN_FILE: 'C:/Efesto/kernel-data/kernel-api-token' };
const good = { host: '127.0.0.1:3311', origin: 'http://127.0.0.1:3311', 'sec-fetch-site': 'same-origin', 'x-efesto-local': '1' };
function req(path: string, headers: Record<string, string> = good, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1:3311${path}`, { ...init, headers });
}
function recorder(response = new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } })) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: URL, init: RequestInit) => { calls.push({ url: String(url), init }); return response; }) as unknown as typeof fetch;
  return { calls, fetcher };
}

describe('local Kernel bridge (installed Windows dashboard)', () => {
  it('is disabled unless the stack configured the token file (hosted builds stay off)', async () => {
    const off = await localStatus(req('/efesto-local/status'), { env: {} });
    expect(await off.json()).toEqual({ ok: true, enabled: false });
    const { calls, fetcher } = recorder();
    expect((await proxyToLocalKernel(req('/x'), ['api', 'cases'], { env: {}, fetcher })).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('reports enabled for a same-origin loopback request', async () => {
    const res = await localStatus(req('/efesto-local/status'), { env });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enabled: true });
  });

  it.each([
    [{ ...good, host: 'evil.example:3311' }, 'HOST_FORBIDDEN'],
    [{ ...good, origin: 'https://evil.example' }, 'ORIGIN_FORBIDDEN'],
    [{ ...good, 'sec-fetch-site': 'cross-site' }, 'CROSS_SITE_FORBIDDEN'],
    [{ host: good.host, origin: good.origin }, 'MARKER_REQUIRED'],
  ])('refuses non-local or cross-site callers (%#)', (headers, code) => {
    expect(checkLocalRequest(req('/x', headers as Record<string, string>))).toMatchObject({ ok: false, code });
  });

  it('only exposes the Kernel public probes and /api/*', () => {
    expect(kernelPathFrom(['health'])).toBe('/health');
    expect(kernelPathFrom(['api', 'chat', 'providers'])).toBe('/api/chat/providers');
    expect(kernelPathFrom(['replay-lab'])).toBeUndefined();
    expect(kernelPathFrom(['api', '..', 'x'])).toBeUndefined();
    expect(kernelPathFrom(['api', 'a%2f..'])).toBeUndefined();
  });

  it('refuses a non-loopback Kernel URL', () => {
    expect(() => localKernelUrl({ EFESTO_LOCAL_KERNEL_URL: 'http://10.0.0.2:4310' })).toThrow('NON_LOOPBACK_KERNEL_URL');
    expect(localKernelUrl({})).toBe('http://127.0.0.1:4310');
  });

  it('adds the real token server-side, replaces any browser token and never returns it', async () => {
    const { calls, fetcher } = recorder();
    const res = await proxyToLocalKernel(req('/efesto-local/kernel/api/cases?limit=2', { ...good, 'x-hephaestus-token': 'efesto-local-transport-v1' }), ['api', 'cases'], { env, fetcher, readToken: async () => `${TOKEN}\n` });
    expect(res.status).toBe(200);
    expect(calls[0].url).toBe('http://127.0.0.1:4310/api/cases?limit=2');
    const headers = new Headers(calls[0].init.headers);
    expect(headers.get('x-hephaestus-token')).toBe(TOKEN);
    expect(headers.get('origin')).toBe('http://127.0.0.1:3311');
    expect(JSON.stringify([...res.headers])).not.toContain(TOKEN);
    expect(await res.text()).not.toContain(TOKEN);
  });

  it('does not attach the token to public probes', async () => {
    const { calls, fetcher } = recorder();
    await proxyToLocalKernel(req('/efesto-local/kernel/health'), ['health'], { env, fetcher, readToken: async () => TOKEN });
    expect(new Headers(calls[0].init.headers).get('x-hephaestus-token')).toBeNull();
  });

  it('fails closed when the token is missing or malformed, without calling the Kernel', async () => {
    const { calls, fetcher } = recorder();
    const res = await proxyToLocalKernel(req('/x'), ['api', 'cases'], { env, fetcher, readToken: async () => { throw new Error('ENOENT'); } });
    expect(res.status).toBe(503);
    expect((await proxyToLocalKernel(req('/x'), ['api', 'cases'], { env, fetcher, readToken: async () => 'short' })).status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it('maps an offline Kernel to 502 and forwards POST bodies', async () => {
    const offline = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    expect((await proxyToLocalKernel(req('/x'), ['api', 'cases'], { env, fetcher: offline, readToken: async () => TOKEN })).status).toBe(502);
    const { calls, fetcher } = recorder();
    await proxyToLocalKernel(req('/x', { ...good, 'content-type': 'application/json' }, { method: 'POST', body: '{"a":1}' }), ['api', 'goals'], { env, fetcher, readToken: async () => TOKEN });
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.body).toBe('{"a":1}');
  });
});
