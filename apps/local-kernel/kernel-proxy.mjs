/**
 * Loopback reverse proxy used by the one-click Kernel (public port → internal Kernel).
 */
export const MAX_PROXY_BODY_BYTES = 1024 * 1024;

export function createKernelProxyHandler({ internalBaseUrl, onMissionStart = () => {}, fetchImpl = fetch, maxBodyBytes = MAX_PROXY_BODY_BYTES }) {
  return async function handleProxyRequest(request, response) {
    try {
      const body = await readBody(request, maxBodyBytes);
      const headers = forwardHeaders(request.headers);
      // Client gone → abort the upstream request (releases Kernel event-bus/chat streams).
      const abort = new AbortController();
      response.once('close', () => { if (!response.writableEnded) abort.abort(); });
      const upstream = await fetchImpl(`${internalBaseUrl}${request.url ?? '/'}`, {
        method: request.method,
        headers,
        body: body.length ? body : undefined,
        redirect: 'manual',
        signal: abort.signal,
      });
      if (isStreamingResponse(upstream)) return await pipeStream(upstream, response);
      const payload = Buffer.from(await upstream.arrayBuffer());
      response.statusCode = upstream.status;
      copyHeaders(upstream, response);
      response.end(payload);

      if (isMissionStart(request, upstream.status)) {
        const token = String(request.headers['x-hephaestus-token'] ?? '').trim();
        const parsed = parseJson(payload);
        if (token && parsed?.mission) onMissionStart(parsed.mission, token);
      }
    } catch (error) {
      if (response.headersSent) return response.destroy(error instanceof Error ? error : undefined);
      response.statusCode = 502;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ ok: false, code: 'KERNEL_PROXY_FAILED', error: safeMessage(error) }));
    }
    return undefined;
  };
}

const STREAMING_TYPES = ['text/event-stream', 'application/x-ndjson'];

function isStreamingResponse(upstream) {
  const type = String(upstream.headers.get('content-type') ?? '').toLowerCase();
  return Boolean(upstream.body) && STREAMING_TYPES.some((streaming) => type.startsWith(streaming));
}

/** SSE / NDJSON never fit arrayBuffer(): forward chunks as they arrive, honoring backpressure. */
async function pipeStream(upstream, response) {
  response.statusCode = upstream.status;
  copyHeaders(upstream, response);
  response.flushHeaders();
  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (response.destroyed) break;
      if (!response.write(value)) await waitForDrain(response);
    }
  } catch {
    // Upstream aborted (client left) or failed mid-stream: nothing more to forward.
  } finally {
    reader.cancel().catch(() => {});
    if (!response.writableEnded && !response.destroyed) response.end();
  }
  return undefined;
}

function waitForDrain(response) {
  return new Promise((resolve) => {
    const done = () => { response.off('drain', done); response.off('close', done); resolve(); };
    response.once('drain', done);
    response.once('close', done);
  });
}

function copyHeaders(upstream, response) {
  for (const [name, value] of upstream.headers) {
    if (!['content-length', 'transfer-encoding', 'connection'].includes(name.toLowerCase())) response.setHeader(name, value);
  }
}

export function isMissionStart(request, status) {
  return request.method === 'POST' && status >= 200 && status < 300 && /^\/api\/goals\/[^/]+\/missions$/.test(request.url ?? '');
}

function forwardHeaders(headers) {
  const forwarded = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !['host', 'connection', 'content-length'].includes(name.toLowerCase())) forwarded[name] = value;
  }
  return forwarded;
}

async function readBody(request, maxBodyBytes) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new Error('Request body exceeded the proxy limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseJson(value) {
  try { return JSON.parse(value.toString('utf8')); }
  catch { return undefined; }
}

export function safeMessage(error) {
  return String(error instanceof Error ? error.message : error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
}
