// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installExtensionPairHandoff, PAIR_PAGE_CODE, PAIR_PAGE_REQUEST } from './extension-pair-handoff';

let stop: (() => void) | undefined;
afterEach(() => { stop?.(); stop = undefined; });

function request(nonce = 'n-1', origin = window.location.origin, source: MessageEventSource | null = window) {
  window.dispatchEvent(new MessageEvent('message', { data: { type: PAIR_PAGE_REQUEST, nonce }, origin, source }));
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('dashboard → extension pairing handoff', () => {
  it('mints a code through the local bridge and posts it back to the same origin only', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true, code: 'ABCD2345', expiresAt: 'x' }));
    const post = vi.spyOn(window, 'postMessage');
    stop = installExtensionPairHandoff({ fetcher: fetcher as unknown as typeof fetch, kernelUrl: 'http://127.0.0.1:4310' });
    request('n-1'); await flush(); await flush();
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:4310/api/pairing/extension-code', { method: 'POST' });
    expect(post).toHaveBeenCalledWith({ type: PAIR_PAGE_CODE, nonce: 'n-1', code: 'ABCD2345', kernelUrl: 'http://127.0.0.1:4310' }, window.location.origin);
    post.mockRestore();
  });

  it('ignores other origins, other windows and malformed requests', async () => {
    const fetcher = vi.fn(async () => Response.json({ ok: true, code: 'ABCD2345' }));
    stop = installExtensionPairHandoff({ fetcher: fetcher as unknown as typeof fetch, kernelUrl: 'http://127.0.0.1:4310' });
    request('n', 'https://evil.example'); request('n', window.location.origin, null);
    window.dispatchEvent(new MessageEvent('message', { data: { type: PAIR_PAGE_REQUEST }, origin: window.location.origin, source: window }));
    await flush();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('caps codes per page and stays silent when the Kernel refuses', async () => {
    const ok = vi.fn(async () => Response.json({ ok: true, code: 'ABCD2345' }));
    stop = installExtensionPairHandoff({ fetcher: ok as unknown as typeof fetch, kernelUrl: 'http://127.0.0.1:4310' });
    for (let i = 0; i < 5; i += 1) { request(`n${i}`); await flush(); await flush(); }
    expect(ok).toHaveBeenCalledTimes(3);
    stop(); stop = undefined;
    const refused = vi.fn(async () => Response.json({ ok: false }, { status: 429 }));
    const post = vi.spyOn(window, 'postMessage');
    stop = installExtensionPairHandoff({ fetcher: refused as unknown as typeof fetch, kernelUrl: 'http://127.0.0.1:4310' });
    request('z'); await flush(); await flush();
    expect(post).not.toHaveBeenCalled();
    post.mockRestore();
  });
});
