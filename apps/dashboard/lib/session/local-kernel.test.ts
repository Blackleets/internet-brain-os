// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { discoverLocalKernelConnection, localFetch, LOCAL_TRANSPORT } from './local-kernel';
import { kernelFetch } from './extension-bridge';

describe('installed-mode local Kernel transport', () => {
  it('discovers the same-origin bridge without any extension or pairing code', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fetcher = (async (url: string, init?: RequestInit) => { calls.push([url, init]); return new Response('{"ok":true,"enabled":true}'); }) as unknown as typeof fetch;
    await expect(discoverLocalKernelConnection(undefined, fetcher)).resolves.toEqual({ baseUrl: 'http://127.0.0.1:4310', token: LOCAL_TRANSPORT });
    expect(calls[0][0]).toBe('/efesto-local/status');
    expect(new Headers(calls[0][1]?.headers).get('x-efesto-local')).toBe('1');
  });

  it('reports unavailable when the bridge is disabled (hosted dashboard)', async () => {
    const fetcher = (async () => new Response('{"ok":false}', { status: 404 })) as unknown as typeof fetch;
    await expect(discoverLocalKernelConnection(undefined, fetcher)).rejects.toThrow('LOCAL_UNAVAILABLE');
  });

  it('rewrites Kernel calls to the bridge and drops the transport sentinel header', async () => {
    const calls: [string, RequestInit][] = [];
    const fetch = localFetch((async (url: string, init: RequestInit) => { calls.push([url, init]); return new Response('{}'); }) as unknown as typeof globalThis.fetch);
    await fetch('http://127.0.0.1:4310/api/cases?x=1', { headers: { 'x-hephaestus-token': LOCAL_TRANSPORT } });
    expect(calls[0][0]).toBe('/efesto-local/kernel/api/cases?x=1');
    const headers = new Headers(calls[0][1].headers);
    expect(headers.get('x-hephaestus-token')).toBeNull();
    expect(headers.get('x-efesto-local')).toBe('1');
    expect(() => fetch('http://evil.example/api/cases')).toThrow();
  });

  it('kernelFetch selects the local transport for the sentinel', () => {
    expect(kernelFetch(LOCAL_TRANSPORT)).not.toBe(kernelFetch('real-token'));
  });
});
