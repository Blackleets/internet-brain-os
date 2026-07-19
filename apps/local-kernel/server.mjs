import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { InboxError, MAX_BODY_BYTES, PageContextInbox } from './page-context-inbox.mjs';

const host = process.env.HEPHAESTUS_HOST ?? '127.0.0.1';
const port = Number(process.env.HEPHAESTUS_PORT ?? 4000);
const dataFile = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus', 'page-context-inbox.jsonl');
const inbox = new PageContextInbox(dataFile);

export function createLocalKernelServer(captureInbox) {
  return createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && !isAllowedOrigin(origin)) {
      return send(response, 403, { ok: false, code: 'ORIGIN_FORBIDDEN' });
    }
    setCors(origin, response);
    if (request.method === 'OPTIONS') return send(response, 204);
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, service: 'hephaestus-local-kernel' });
    }
    if (request.method !== 'POST' || request.url !== '/api/browser/page-context') {
      return send(response, 404, { ok: false, code: 'NOT_FOUND' });
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    try {
      const body = await readJson(request);
      const receipt = await captureInbox.accept(body);
      return send(response, 202, { ok: true, ...receipt });
    } catch (error) {
      const known = error instanceof InboxError;
      return send(response, known ? error.status : 500, {
        ok: false,
        code: known ? error.code : 'INTERNAL_ERROR',
        error: known ? error.message : 'Unable to store page context',
      });
    }
  });
}

export const server = createLocalKernelServer(inbox);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  server.listen(port, host, () => console.log(`Hephaestus local Kernel listening on http://${host}:${port}`));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new InboxError('PAYLOAD_TOO_LARGE', 'Payload exceeds 32 KiB', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new InboxError('INVALID_JSON', 'Request body must be valid JSON'); }
}

function isAllowedOrigin(origin) {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function setCors(origin, response) {
  if (typeof origin === 'string' && isAllowedOrigin(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('x-content-type-options', 'nosniff');
}

function send(response, status, body) {
  response.statusCode = status;
  if (body === undefined) return response.end();
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
