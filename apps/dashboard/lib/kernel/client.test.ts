import { describe, expect, it } from 'vitest';
import { KernelClient, KernelClientError } from './client';

const token = 'private-dashboard-token';

function clientWith(fetcher: typeof fetch, timeoutMs?: number): KernelClient {
  return new KernelClient({
    baseUrl: 'http://localhost:4310/',
    token,
    fetcher,
    timeoutMs,
  });
}

describe('KernelClient', () => {
  it('adds the token only to authenticated API paths while retaining JSON no-store defaults', async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    const client = clientWith(fetcher);

    await client.get('/api/cases', (value) => value);
    await client.get('/health', (value) => value);
    await client.get('/status', (value) => value);
    await client.get('/bootstrap/status', (value) => value);

    expect(calls.map(([input]) => String(input))).toEqual([
      'http://localhost:4310/api/cases',
      'http://localhost:4310/health',
      'http://localhost:4310/status',
      'http://localhost:4310/bootstrap/status',
    ]);
    expect(new Headers(calls[0][1]?.headers).get('x-hephaestus-token')).toBe(token);
    expect(calls.slice(1).map(([, init]) => new Headers(init?.headers).get('x-hephaestus-token'))).toEqual([null, null, null]);
    expect(calls.map(([, init]) => init?.cache)).toEqual(['no-store', 'no-store', 'no-store', 'no-store']);
    expect(calls.map(([, init]) => new Headers(init?.headers).get('accept'))).toEqual(['application/json', 'application/json', 'application/json', 'application/json']);
  });

  it('does not include a content type when the request has no body', async () => {
    const calls: RequestInit[] = [];
    const client = clientWith(async (_input, init) => {
      calls.push(init!);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await client.request('/api/cases', { method: 'POST' }, (value) => value);

    expect(new Headers(calls[0].headers).get('content-type')).toBeNull();
  });

  it('adds a JSON content type when a request has a body', async () => {
    const calls: RequestInit[] = [];
    const client = clientWith(async (_input, init) => {
      calls.push(init!);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await client.request('/api/cases', { method: 'POST', body: JSON.stringify({ title: 'New case' }) }, (value) => value);

    expect(new Headers(calls[0].headers).get('content-type')).toBe('application/json');
  });

  it('maps a 401 response to UNAUTHORIZED without exposing the token', async () => {
    const client = clientWith(async () => new Response('unauthorized', { status: 401 }));

    await expect(client.get('/api/cases', (value) => value)).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'UNAUTHORIZED',
    } satisfies Pick<KernelClientError, 'name' | 'code'>);
    await expect(client.get('/api/cases', (value) => value)).rejects.not.toThrow(token);
  });

  it('preserves a non-sensitive HTTP status for HTTP errors', async () => {
    const client = clientWith(async () => new Response('kernel failure', { status: 500 }));

    await expect(client.get('/api/cases', (value) => value)).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'HTTP_ERROR',
      status: 500,
    } satisfies Pick<KernelClientError, 'name' | 'code' | 'status'>);
  });

  it('preserves a 404 status without exposing the response body or token', async () => {
    const client = clientWith(async () => new Response(`not found: ${token}`, { status: 404 }));

    await expect(client.get('/api/model-forge', (value) => value)).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'HTTP_ERROR',
      status: 404,
    } satisfies Pick<KernelClientError, 'name' | 'code' | 'status'>);
    await expect(client.get('/api/model-forge', (value) => value)).rejects.not.toThrow(token);
  });

  it('maps a rejected fetch to OFFLINE without exposing the token', async () => {
    const client = clientWith(async () => {
      throw new Error(`connection refused for ${token}`);
    });

    await expect(client.get('/api/cases', (value) => value)).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'OFFLINE',
    } satisfies Pick<KernelClientError, 'name' | 'code'>);
    await expect(client.get('/api/cases', (value) => value)).rejects.not.toThrow(token);
  });

  it('maps parser failures to INVALID_RESPONSE without exposing the token', async () => {
    const client = clientWith(async () => new Response(JSON.stringify({ ok: true, token }), { status: 200 }));

    await expect(client.get('/api/cases', () => {
      throw new Error(`unexpected response ${token}`);
    })).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'INVALID_RESPONSE',
    } satisfies Pick<KernelClientError, 'name' | 'code'>);
    await expect(client.get('/api/cases', () => {
      throw new Error(`unexpected response ${token}`);
    })).rejects.not.toThrow(token);
  });

  it('aborts a hung request at the configured timeout and reports TIMEOUT', async () => {
    const client = clientWith((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    }), 10);

    await expect(client.get('/api/cases', (value) => value)).rejects.toMatchObject({
      name: 'KernelClientError',
      code: 'TIMEOUT',
    } satisfies Pick<KernelClientError, 'name' | 'code'>);
  });

  it.each(['/health', '/status', '/bootstrap/status'])('removes a caller-provided token from the public %s route', async (path) => {
    let headers: Headers | undefined;
    const client = clientWith(async (_input, init) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await client.request(path, { headers: { 'x-hephaestus-token': 'caller-supplied-token' } }, (value) => value);

    expect(headers?.get('x-hephaestus-token')).toBeNull();
  });

  it('uses the normalized path before deciding whether to send the token', async () => {
    let receivedUrl: string | undefined;
    let headers: Headers | undefined;
    const client = clientWith(async (input, init) => {
      receivedUrl = String(input);
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await client.request('/api/../health', { headers: { 'x-hephaestus-token': 'caller-supplied-token' } }, (value) => value);

    expect(receivedUrl).toBe('http://localhost:4310/health');
    expect(headers?.get('x-hephaestus-token')).toBeNull();
  });
});
