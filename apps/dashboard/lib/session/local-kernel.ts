// Installed (Windows one-click) mode: the dashboard is served from 127.0.0.1 next to the Kernel and
// reaches it through its own same-origin bridge (/efesto-local/kernel). No extension, no pairing code:
// the real token stays on the server side of the bridge. This value is a transport selector only.
import { normalizeKernelBaseUrl } from '../kernel/url';

export const LOCAL_TRANSPORT = 'efesto-local-transport-v1';
export const LOCAL_KERNEL_BASE_URL = 'http://127.0.0.1:4310';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

export async function discoverLocalKernelConnection(signal?: AbortSignal, fetcher: typeof fetch = globalThis.fetch): Promise<{ baseUrl: string; token: string }> {
  if (typeof window === 'undefined' || !LOOPBACK.has(window.location.hostname) || window.location.protocol !== 'http:' || window !== window.top) {
    throw new Error('LOCAL_UNAVAILABLE');
  }
  // Tiny same-origin probe: not tied to the caller's signal (an aborted probe would surface as a failed
  // request in the browser); the result is simply ignored once the caller aborted.
  const response = await fetcher('/efesto-local/status', { cache: 'no-store', headers: { 'x-efesto-local': '1' } });
  if (signal?.aborted || !response.ok) throw new Error('LOCAL_UNAVAILABLE');
  const body = await response.json().catch(() => undefined) as { ok?: unknown; enabled?: unknown } | undefined;
  if (body?.ok !== true || body.enabled !== true) throw new Error('LOCAL_UNAVAILABLE');
  return { baseUrl: normalizeKernelBaseUrl(LOCAL_KERNEL_BASE_URL), token: LOCAL_TRANSPORT };
}

/** Rewrites Kernel URLs to the same-origin bridge; the sentinel never leaves the browser as a credential. */
export function localFetch(fetcher: typeof fetch = (i, n) => globalThis.fetch(i, n)): typeof fetch {
  return (input, init = {}) => {
    const url = new URL(String(input));
    normalizeKernelBaseUrl(url.origin);
    const headers = new Headers(init.headers);
    headers.delete('x-hephaestus-token');
    headers.set('x-efesto-local', '1');
    return fetcher(`/efesto-local/kernel${url.pathname}${url.search}`, { ...init, headers, credentials: 'same-origin' });
  };
}
