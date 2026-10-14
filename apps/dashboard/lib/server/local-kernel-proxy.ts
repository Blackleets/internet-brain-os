// Same-origin bridge between the locally installed dashboard (next start on 127.0.0.1) and the local
// Kernel. The Kernel token is read server-side from the file the Kernel itself writes and is added
// here; it never reaches the browser, the URL, logs or responses. Disabled unless the Windows stack
// started the dashboard with EFESTO_LOCAL_KERNEL_TOKEN_FILE (so it is off on Vercel/hosted builds).
import { readFile } from 'node:fs/promises';

export const LOCAL_MARKER_HEADER = 'x-efesto-local';
export const DEFAULT_LOCAL_KERNEL_URL = 'http://127.0.0.1:4310';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const PUBLIC_PATHS = new Set(['/health', '/status', '/bootstrap/status']);
const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'last-event-id'];
const TOKEN_PATTERN = /^[!-~]{32,512}$/;

export type LocalProxyEnv = { EFESTO_LOCAL_KERNEL_TOKEN_FILE?: string; EFESTO_LOCAL_KERNEL_URL?: string; [key: string]: string | undefined };
export type LocalProxyDeps = {
  env?: LocalProxyEnv;
  readToken?: (file: string) => Promise<string>;
  fetcher?: typeof fetch;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

export function localProxyEnabled(env: LocalProxyEnv = process.env): boolean {
  return typeof env.EFESTO_LOCAL_KERNEL_TOKEN_FILE === 'string' && env.EFESTO_LOCAL_KERNEL_TOKEN_FILE.trim() !== '';
}

/** Loopback-only Kernel URL; anything else is refused (the bridge never talks to another host). */
export function localKernelUrl(env: LocalProxyEnv = process.env): string {
  const url = new URL(env.EFESTO_LOCAL_KERNEL_URL || DEFAULT_LOCAL_KERNEL_URL);
  if (url.protocol !== 'http:' || !LOOPBACK.has(url.hostname)) throw new Error('NON_LOOPBACK_KERNEL_URL');
  return url.origin;
}

function hostOf(value: string | null): string | undefined {
  if (!value) return undefined;
  try { return new URL(`http://${value}`).hostname; } catch { return undefined; }
}

/**
 * Browser guard: the request must be addressed to a loopback Host (blocks DNS rebinding), come from
 * this same origin (blocks other sites; the custom marker header forces a CORS preflight that Next
 * never approves) and never be a cross-site fetch.
 */
export function checkLocalRequest(request: Request): { ok: true; origin: string } | { ok: false; status: number; code: string } {
  const host = request.headers.get('host');
  const hostname = hostOf(host);
  if (!host || !hostname || !LOOPBACK.has(hostname)) return { ok: false, status: 403, code: 'HOST_FORBIDDEN' };
  const ownOrigin = `http://${host}`;
  const origin = request.headers.get('origin');
  if (origin !== null && origin !== ownOrigin) return { ok: false, status: 403, code: 'ORIGIN_FORBIDDEN' };
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return { ok: false, status: 403, code: 'CROSS_SITE_FORBIDDEN' };
  if (request.headers.get(LOCAL_MARKER_HEADER) !== '1') return { ok: false, status: 403, code: 'MARKER_REQUIRED' };
  return { ok: true, origin: ownOrigin };
}

/** Kernel path from the catch-all segments; only the Kernel's public probes and /api/* are reachable. */
export function kernelPathFrom(segments: string[]): string | undefined {
  if (!segments.length || segments.some((s) => s === '' || s === '.' || s === '..' || /[\\/?#%]/.test(s))) return undefined;
  const path = `/${segments.join('/')}`;
  if (PUBLIC_PATHS.has(path) || path === '/api' || path.startsWith('/api/')) return path;
  return undefined;
}

export async function localStatus(request: Request, deps: LocalProxyDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  // 200 + enabled:false (not 404) so a hosted/dev dashboard probing it logs no browser error.
  if (!localProxyEnabled(env)) return json(200, { ok: true, enabled: false });
  const guard = checkLocalRequest(request);
  if (!guard.ok) return json(guard.status, { ok: false, code: guard.code });
  return json(200, { ok: true, enabled: true });
}

export async function proxyToLocalKernel(request: Request, segments: string[], deps: LocalProxyDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!localProxyEnabled(env)) return json(404, { ok: false, code: 'LOCAL_KERNEL_DISABLED' });
  const guard = checkLocalRequest(request);
  if (!guard.ok) return json(guard.status, { ok: false, code: guard.code });
  const path = kernelPathFrom(segments);
  if (!path) return json(404, { ok: false, code: 'NOT_FOUND' });
  let base: string;
  try { base = localKernelUrl(env); } catch { return json(500, { ok: false, code: 'LOCAL_KERNEL_MISCONFIGURED' }); }
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) { const v = request.headers.get(name); if (v !== null) headers.set(name, v); }
  // The Kernel judges interactive confirmations by Origin; this is the verified same-origin dashboard.
  headers.set('origin', guard.origin);
  if (path.startsWith('/api')) {
    let token = '';
    try { token = (await (deps.readToken ?? ((f) => readFile(f, 'utf8')))(String(env.EFESTO_LOCAL_KERNEL_TOKEN_FILE))).trim(); } catch { /* handled below */ }
    if (!TOKEN_PATTERN.test(token)) return json(503, { ok: false, code: 'LOCAL_KERNEL_NOT_READY' });
    headers.set('x-hephaestus-token', token);
  }
  const url = new URL(path, base);
  url.search = new URL(request.url).search;
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  let upstream: Response;
  try {
    upstream = await (deps.fetcher ?? fetch)(url, { method, headers, body, redirect: 'manual', cache: 'no-store', signal: request.signal });
  } catch {
    return json(502, { ok: false, code: 'LOCAL_KERNEL_OFFLINE' });
  }
  const out = new Headers({ 'cache-control': 'no-store' });
  const type = upstream.headers.get('content-type');
  if (type) out.set('content-type', type);
  if (upstream.status >= 300 && upstream.status < 400) return json(502, { ok: false, code: 'LOCAL_KERNEL_REDIRECT' });
  return new Response([204, 205, 304].includes(upstream.status) ? null : upstream.body, { status: upstream.status, headers: out });
}
