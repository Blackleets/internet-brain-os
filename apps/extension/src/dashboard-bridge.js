// Only the explicitly approved production dashboard may use this extension as a transport.
// The Kernel token never leaves the service worker. Kernel authorization still owns every action.
export const DASHBOARD_ORIGIN = 'https://efesto-five.vercel.app';
export const BRIDGE_NAME = 'efesto.dashboard.v1';
export const MAX_BRIDGE_BODY = 1_048_576;
export const MAX_BRIDGE_RESPONSE = 8_388_608;

export function approvedDashboardSender(sender) {
  try {
    const url = new URL(sender?.url);
    return sender?.id === undefined && sender?.origin === DASHBOARD_ORIGIN
      && url.origin === DASHBOARD_ORIGIN && url.pathname === '/'
      && sender?.frameId === 0 && Number.isInteger(sender?.tab?.id)
      && sender?.tab?.incognito !== true;
  } catch { return false; }
}

export function bridgeRequestAllowed(message) {
  if (!message || typeof message.path !== 'string' || message.path.length > 2048) return false;
  const { method = 'GET', body } = message;
  const path = message.path.replace(/%3a/gi, ':');
  if (body !== undefined && (typeof body !== 'string' || new TextEncoder().encode(body).length > MAX_BRIDGE_BODY)) return false;
  if (/[\\#%]/.test(path) || path.includes('..') || !path.startsWith('/') || path.startsWith('//')) return false;
  if (method === 'GET' && body === undefined) {
    return /^(?:\/health|\/status|\/bootstrap\/status|\/api\/(?:events|agents|browser\/case|model-forge|preferences|goals|goal-surfaces|opportunities|cases|agent-missions|chat\/providers|chat\/conversations)(?:\/[A-Za-z0-9_:-]+)*)(?:\?[^#]*)?$/.test(path)
      && !/\/api\/agents\/|\/api\/agent-missions\/(?:claim|results|failures)/.test(path);
  }
  return (method === 'POST' && /^(?:\/api\/goals|\/api\/goals\/[A-Za-z0-9_:-]+\/(?:research|confirm|missions|revisions)|\/api\/opportunities\/[A-Za-z0-9_:-]+\/feedback|\/api\/chat\/(?:stream|providers|conversations))$/.test(path))
    || (method === 'PATCH' && /^\/api\/goals\/[A-Za-z0-9_:-]+$/.test(path))
    || (method === 'DELETE' && /^\/api\/chat\/(?:providers|conversations)\/[A-Za-z0-9_:-]+$/.test(path));
}

export function bridgeBaseUrl(value = 'http://127.0.0.1:4000') {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
      || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid loopback');
  return url.origin;
}

export function installDashboardBridge(chromeApi, fetcher = fetch) {
  const active = new Set();
  chromeApi.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dashboardAutoConnect || changes.kernelApiToken || changes.kernelBaseUrl)) {
      for (const stop of active) stop();
    }
  });
  chromeApi.runtime.onMessageExternal?.addListener((message, sender, respond) => {
    if (!approvedDashboardSender(sender)) return false;
    if (!['EFESTO_CONNECTION', 'EFESTO_FORGET'].includes(message?.type)) return false;
    void (async () => {
      try {
        if (message.type === 'EFESTO_FORGET') {
          await chromeApi.storage.local.set({ dashboardAutoConnect: false });
          respond({ ok: true }); return;
        }
        const stored = await chromeApi.storage.local.get(['dashboardAutoConnect', 'kernelApiToken', 'kernelBaseUrl']);
        if (stored.dashboardAutoConnect !== true || !validToken(stored.kernelApiToken)) { respond({ ok: false, code: 'PAIR_EXTENSION' }); return; }
        respond({ ok: true, baseUrl: bridgeBaseUrl(stored.kernelBaseUrl) });
      } catch { respond({ ok: false, code: 'UNAVAILABLE' }); }
    })();
    return true;
  });
  chromeApi.runtime.onConnectExternal?.addListener((port) => {
    if (port.name !== BRIDGE_NAME || !approvedDashboardSender(port.sender) || active.size >= 32) { port.disconnect(); return; }
    const abort = new AbortController();
    let reader;
    let started = false;
    let finished = false;
    const stop = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      abort.abort();
      void reader?.cancel().catch(() => undefined);
      active.delete(stop);
      try { port.disconnect(); } catch {}
    };
    const timer = setTimeout(stop, 120_000);
    active.add(stop);
    port.onDisconnect.addListener(stop);
    port.onMessage.addListener((message) => {
      if (started) { stop(); return; }
      started = true;
      void (async () => {
        try {
          if (!bridgeRequestAllowed(message)) throw new Error('Denied');
          const stored = await chromeApi.storage.local.get(['dashboardAutoConnect', 'kernelApiToken', 'kernelBaseUrl']);
          if (stored.dashboardAutoConnect !== true || !validToken(stored.kernelApiToken) || finished) throw new Error('Not paired');
          const headers = { accept: message.path === '/api/events' ? 'text/event-stream' : 'application/json' };
          if (message.path.startsWith('/api/')) headers['x-hephaestus-token'] = stored.kernelApiToken;
          if (message.body !== undefined) headers['content-type'] = 'application/json';
          const response = await fetcher(`${bridgeBaseUrl(stored.kernelBaseUrl)}${message.path}`, {
            method: message.method ?? 'GET', body: message.body, headers, signal: abort.signal,
            redirect: 'error', cache: 'no-store', credentials: 'omit',
          });
          if (finished) return;
          port.postMessage({ type: 'headers', status: response.status, contentType: response.headers.get('content-type') ?? 'application/json' });
          reader = response.body?.getReader();
          let total = 0;
          while (reader && !finished) {
            const { value, done } = await reader.read();
            if (done) break;
            total += value.byteLength;
            if (total > MAX_BRIDGE_RESPONSE) throw new Error('Response too large');
            // Chrome Port messages use JSON serialization, not structured clone.
            for (let i = 0; i < value.length; i += 16_384) port.postMessage({ type: 'chunk', bytes: Array.from(value.subarray(i, i + 16_384)) });
          }
          if (!finished) port.postMessage({ type: 'done' });
        } catch { if (!finished) { try { port.postMessage({ type: 'error', code: 'BRIDGE_UNAVAILABLE' }); } catch {} } }
        finally { try { reader?.releaseLock(); } catch {} }
      })();
    });
  });
}
function validToken(value) { return typeof value === 'string' && /^[\x21-\x7e]{32,512}$/.test(value); }
