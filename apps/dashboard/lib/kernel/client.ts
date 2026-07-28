import { normalizeKernelBaseUrl } from './url';

export type KernelClientErrorCode = 'UNAUTHORIZED' | 'OFFLINE' | 'TIMEOUT' | 'HTTP_ERROR' | 'INVALID_RESPONSE';

export class KernelClientError extends Error {
  constructor(readonly code: KernelClientErrorCode, readonly status?: number) {
    super(code);
    this.name = 'KernelClientError';
  }
}

export type KernelClientOptions = {
  baseUrl: string;
  token: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

export class KernelClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: KernelClientOptions) {
    this.baseUrl = normalizeKernelBaseUrl(options.baseUrl);
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init));
    this.timeoutMs = boundedTimeout(options.timeoutMs);
  }

  get<T>(path: string, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    return this.request(path, { method: 'GET' }, parse, signal);
  }

  async request<T>(path: string, init: RequestInit, parse: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    const request = withTimeout(signal, this.timeoutMs);
    const url = this.url(path);

    try {
      const response = await this.fetcher(url, {
        ...init,
        cache: 'no-store',
        headers: this.headersFor(url, init),
        signal: request.signal,
      });

      if (response.status === 401) throw new KernelClientError('UNAUTHORIZED', response.status);
      if (!response.ok) throw new KernelClientError('HTTP_ERROR', response.status);

      let body: unknown;
      try {
        body = await response.json();
        return parse(body);
      } catch (error) {
        if (error instanceof KernelClientError) throw error;
        throw new KernelClientError('INVALID_RESPONSE');
      }
    } catch (error) {
      if (error instanceof KernelClientError) throw error;
      if (request.timedOut()) throw new KernelClientError('TIMEOUT');
      throw new KernelClientError('OFFLINE');
    } finally {
      request.dispose();
    }
  }

  async streamNdjson<T>(path: string, init: RequestInit, onEvent: (event: T) => void | Promise<void>, signal?: AbortSignal): Promise<void> {
    const request = withTimeout(signal, this.timeoutMs);
    const url = this.url(path);
    try {
      const response = await this.fetcher(url, {
        ...init,
        cache: 'no-store',
        headers: this.headersFor(url, {
          ...init,
          headers: { ...Object.fromEntries(new Headers(init.headers)), accept: 'application/x-ndjson' },
        }),
        signal: request.signal,
      });
      if (response.status === 401) throw new KernelClientError('UNAUTHORIZED', response.status);
      if (!response.ok) throw new KernelClientError('HTTP_ERROR', response.status);
      if (!response.body) throw new KernelClientError('INVALID_RESPONSE');
      const decoder = new TextDecoder();
      let buffer = '';
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index).trim();
          buffer = buffer.slice(index + 1);
          if (line) await onEvent(parseLine<T>(line));
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) await onEvent(parseLine<T>(buffer.trim()));
    } catch (error) {
      if (error instanceof KernelClientError) throw error;
      if (request.timedOut()) throw new KernelClientError('TIMEOUT');
      if (signal?.aborted) throw error;
      throw new KernelClientError('OFFLINE');
    } finally {
      request.dispose();
    }
  }

  private url(path: string): URL {
    return new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);
  }

  private headersFor(url: URL, init: RequestInit): Headers {
    const headers = new Headers(init.headers);
    if (!headers.has('accept')) headers.set('accept', 'application/json');
    if (init.body !== undefined && init.body !== null && !headers.has('content-type')) headers.set('content-type', 'application/json');
    headers.delete('x-hephaestus-token');
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) headers.set('x-hephaestus-token', this.options.token);
    return headers;
  }
}

function parseLine<T>(line: string): T {
  try { return JSON.parse(line) as T; }
  catch { throw new KernelClientError('INVALID_RESPONSE'); }
}

function boundedTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(value ?? DEFAULT_TIMEOUT_MS, 1), MAX_TIMEOUT_MS);
}

function withTimeout(callerSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
} {
  const timeout = AbortSignal.timeout?.(timeoutMs);
  if (timeout && AbortSignal.any) {
    return {
      signal: callerSignal ? AbortSignal.any([callerSignal, timeout]) : timeout,
      timedOut: () => timeout.aborted,
      dispose: () => undefined,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortForCaller = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', abortForCaller, { once: true });
  if (callerSignal?.aborted) abortForCaller();

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', abortForCaller);
    },
  };
}
