import { normalizeKernelBaseUrl } from '../kernel/url';

// A transport selector, never a credential. The real token stays in the extension.
export const EXTENSION_TRANSPORT = 'efesto-extension-transport-v1';
const ORIGIN = 'https://efesto-five.vercel.app';
type Listener<T> = { addListener(fn: (value: T) => void): void };
type Port = { postMessage(value: unknown): void; disconnect(): void; onMessage: Listener<Record<string, unknown>>; onDisconnect: Listener<unknown> };
type Runtime = {
  lastError?: unknown;
  sendMessage(id: string, message: unknown, callback: (response: unknown) => void): void;
  connect(id: string, options: { name: string }): Port;
};
let extensionId: string | undefined;
function runtime(): Runtime | undefined { return (globalThis as unknown as { chrome?: { runtime?: Runtime } }).chrome?.runtime; }

export async function discoverExtensionConnection(signal?: AbortSignal): Promise<{ baseUrl: string; token: string }> {
  if (window.location.origin !== ORIGIN || window !== window.top || signal?.aborted) throw new Error('EXTENSION_UNAVAILABLE');
  const nonce = crypto.randomUUID();
  const id = await new Promise<string>((resolve, reject) => {
    const finish = (value?: string) => {
      clearTimeout(timer); window.removeEventListener('message', onMessage); signal?.removeEventListener('abort', onAbort);
      value ? resolve(value) : reject(new Error('EXTENSION_UNAVAILABLE'));
    };
    const onAbort = () => finish();
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== ORIGIN || event.data?.type !== 'EFESTO_EXTENSION'
          || event.data?.nonce !== nonce || !/^[a-p]{32}$/.test(event.data?.extensionId)) return;
      finish(event.data.extensionId);
    };
    const timer = setTimeout(() => finish(), 2000);
    signal?.addEventListener('abort', onAbort, { once: true });
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'EFESTO_DISCOVER', nonce }, ORIGIN);
  });
  const result = await requestExtension(id, 'EFESTO_CONNECTION');
  if (signal?.aborted || result.ok !== true || typeof result.baseUrl !== 'string') throw new Error('PAIR_EXTENSION');
  const baseUrl = normalizeKernelBaseUrl(result.baseUrl);
  extensionId = id;
  return { baseUrl, token: EXTENSION_TRANSPORT };
}

function requestExtension(id: string, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const api = runtime();
    if (!api?.sendMessage) { reject(new Error('EXTENSION_UNAVAILABLE')); return; }
    const timer = setTimeout(() => reject(new Error('EXTENSION_UNAVAILABLE')), 3000);
    try {
      api.sendMessage(id, { type }, (result) => {
        clearTimeout(timer);
        if (api.lastError || !result || typeof result !== 'object') reject(new Error('EXTENSION_UNAVAILABLE'));
        else resolve(result as Record<string, unknown>);
      });
    } catch { clearTimeout(timer); reject(new Error('EXTENSION_UNAVAILABLE')); }
  });
}

export async function revokeExtensionConnection(): Promise<void> {
  const id = extensionId;
  extensionId = undefined;
  if (id) {
    const result = await requestExtension(id, 'EFESTO_FORGET');
    if (result.ok !== true) throw new Error('REVOCATION_FAILED');
  }
}

export function kernelFetch(token: string): typeof fetch {
  return token === EXTENSION_TRANSPORT ? extensionFetch : (input, init) => globalThis.fetch(input, init);
}

const extensionFetch: typeof fetch = async (input, init = {}) => {
  const id = extensionId;
  const api = runtime();
  if (!id || !api?.connect || init.signal?.aborted) throw new Error('EXTENSION_UNAVAILABLE');
  const url = new URL(String(input));
  normalizeKernelBaseUrl(url.origin);
  // The extension ignores client hosts/headers and always uses its own paired loopback.
  if (init.body != null && typeof init.body !== 'string') throw new Error('INVALID_BODY');
  return new Promise<Response>((resolve, reject) => {
    const port = api.connect(id, { name: 'efesto.dashboard.v1' });
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let settled = false;
    let ended = false;
    let total = 0;
    const cleanup = () => { clearTimeout(timer); init.signal?.removeEventListener('abort', abort); try { port.disconnect(); } catch {} };
    const fail = () => {
      if (ended) return;
      ended = true;
      const error = new Error('EXTENSION_UNAVAILABLE');
      if (settled) controller.error(error); else reject(error);
      cleanup();
    };
    const abort = () => fail();
    const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; }, cancel() { ended = true; cleanup(); } });
    const timer = setTimeout(fail, 125_000);
    init.signal?.addEventListener('abort', abort, { once: true });
    port.onDisconnect.addListener(() => { void api.lastError; fail(); });
    port.onMessage.addListener((message) => {
      if (ended) return;
      if (message.type === 'headers' && !settled && Number.isInteger(message.status) && Number(message.status) >= 200 && Number(message.status) <= 599) {
        settled = true;
        const status = Number(message.status);
        resolve(new Response([204, 205, 304].includes(status) ? null : stream, { status, headers: { 'content-type': typeof message.contentType === 'string' ? message.contentType : 'application/json' } }));
      } else if (message.type === 'chunk' && settled && Array.isArray(message.bytes)
          && message.bytes.length <= 16384 && message.bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) {
        total += message.bytes.length;
        if (total > 8_388_608) { fail(); return; }
        controller.enqueue(new Uint8Array(message.bytes));
      } else if (message.type === 'done' && settled) { ended = true; controller.close(); cleanup(); }
      else fail();
    });
    try { port.postMessage({ path: url.pathname + url.search, method: init.method ?? 'GET', ...(typeof init.body === 'string' ? { body: init.body } : {}) }); }
    catch { fail(); }
  });
};
