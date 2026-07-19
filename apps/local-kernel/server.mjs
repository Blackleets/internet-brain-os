import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CaptureCaseEvidenceProjector, LocalKnowledgeStore } from './capture-projector.mjs';
import { InboxError, MAX_BODY_BYTES, PageContextInbox } from './page-context-inbox.mjs';
import { ObsidianKnowledgeProjector } from './obsidian-projector.mjs';
import { OptionalEvidenceSummarizer } from './optional-evidence-summarizer.mjs';
import { loadOrCreateApiToken, validateApiToken } from './api-token-store.mjs';
import { PairingError, PairingSession } from './pairing-session.mjs';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';

const host = process.env.HEPHAESTUS_HOST ?? '127.0.0.1';
const port = Number(process.env.HEPHAESTUS_PORT ?? 4000);
const dataDir = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus');
const isMain = Boolean(process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href);
const tokenRecord = isMain
  ? await loadOrCreateApiToken(resolve(dataDir, 'kernel-api-token'), {
    envToken: process.env.HEPHAESTUS_API_TOKEN,
    rotate: process.env.HEPHAESTUS_ROTATE_API_TOKEN === '1',
  })
  : { token: validateApiToken('import-only-token-that-is-never-used'), source: 'import' };
const apiToken = tokenRecord.token;
const pairingSession = isMain && (tokenRecord.source === 'created' || tokenRecord.source === 'rotated' || process.env.HEPHAESTUS_PAIRING === '1')
  ? new PairingSession(apiToken)
  : undefined;
const extensionRegistry = new ExtensionIdentityRegistry(resolve(dataDir, 'authorized-extensions.json'));
if (isMain && tokenRecord.source === 'rotated') await extensionRegistry.clear();
const dataFile = resolve(dataDir, 'page-context-inbox.jsonl');
const inbox = new PageContextInbox(dataFile);
const knowledgeStore = new LocalKnowledgeStore(resolve(dataDir, 'store.json'));
const projector = new CaptureCaseEvidenceProjector(knowledgeStore);
const obsidian = new ObsidianKnowledgeProjector(
  knowledgeStore,
  resolve(process.env.HEPHAESTUS_OBSIDIAN_DIR ?? '.hephaestus/obsidian-vault'),
);
const summarizer = new OptionalEvidenceSummarizer(knowledgeStore, {
  model: process.env.HEPHAESTUS_OLLAMA_MODEL,
  baseUrl: process.env.HEPHAESTUS_OLLAMA_URL,
  timeoutMs: Number(process.env.HEPHAESTUS_OLLAMA_TIMEOUT_MS ?? 20_000),
});

export function createLocalKernelServer(captureInbox, captureProjector, obsidianProjector, evidenceSummarizer, options = {}) {
  const requiredToken = options.apiToken === undefined ? undefined : validateApiToken(options.apiToken);
  const activePairing = options.pairingSession;
  const identities = options.extensionRegistry;
  return createServer(async (request, response) => {
    if (!isLoopbackHost(request.headers.host)) {
      return send(response, 403, { ok: false, code: 'HOST_FORBIDDEN' });
    }
    const origin = request.headers.origin;
    if (typeof origin === 'string' && !isAllowedOrigin(origin)) {
      return send(response, 403, { ok: false, code: 'ORIGIN_FORBIDDEN' });
    }
    setCors(origin, response);
    if (request.method === 'OPTIONS') return send(response, 204);
    if (request.method === 'GET' && request.url === '/health') {
      return send(response, 200, { ok: true, service: 'hephaestus-local-kernel' });
    }
    if (request.method === 'POST' && request.url === '/pair') {
      if (!isExtensionOrigin(origin)) return send(response, 403, { ok: false, code: 'PAIRING_ORIGIN_REQUIRED' });
      if (!activePairing) return send(response, 404, { ok: false, code: 'PAIRING_UNAVAILABLE' });
      if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
        return send(response, 415, { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
      }
      try {
        const body = await readJson(request);
        const paired = activePairing.consume(body?.code);
        if (identities) await identities.authorize(origin);
        return send(response, 200, { ok: true, ...paired });
      } catch (error) {
        if (error instanceof PairingError) return send(response, error.status, { ok: false, code: error.code });
        if (error instanceof InboxError) return send(response, error.status, { ok: false, code: error.code });
        return send(response, 500, { ok: false, code: 'INTERNAL_ERROR' });
      }
    }
    if (request.url?.startsWith('/api/') && !hasValidToken(request.headers['x-hephaestus-token'], requiredToken)) {
      return send(response, 401, { ok: false, code: 'AUTH_REQUIRED' });
    }
    if (request.url?.startsWith('/api/') && isExtensionOrigin(origin) && identities) {
      try {
        if (!(await identities.allows(origin))) return send(response, 403, { ok: false, code: 'EXTENSION_NOT_AUTHORIZED' });
      } catch {
        return send(response, 500, { ok: false, code: 'IDENTITY_REGISTRY_UNAVAILABLE' });
      }
    }
    if (request.method === 'GET' && request.url === '/api/cases' && captureProjector) {
      try {
        return send(response, 200, { ok: true, cases: await captureProjector.listCases() });
      } catch {
        return send(response, 500, { ok: false, code: 'INTERNAL_ERROR' });
      }
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
      const projection = captureProjector
        ? await captureProjector.project(receipt.receiptId, body)
        : undefined;
      const intelligence = projection && evidenceSummarizer
        ? await evidenceSummarizer.summarize(projection.evidenceId)
        : undefined;
      const obsidianNotes = projection && obsidianProjector
        ? await obsidianProjector.syncCase(projection.caseId)
        : undefined;
      return send(response, 202, { ok: true, ...receipt, ...projection, intelligence, obsidianNotes });
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

export const server = createLocalKernelServer(inbox, projector, obsidian, summarizer, { apiToken, pairingSession, extensionRegistry });

if (isMain) {
  if (!isLoopbackHostname(host)) throw new Error('HEPHAESTUS_HOST must be a loopback address');
  server.listen(port, host, () => {
    console.log(`Hephaestus local Kernel listening on http://${host}:${port}`);
    if (tokenRecord.source === 'created') console.log(`Extension token created privately at ${tokenRecord.filePath}`);
    else if (tokenRecord.source === 'rotated') console.log(`Extension token rotated privately at ${tokenRecord.filePath}`);
    else if (tokenRecord.source === 'file') console.log(`Using persistent extension token from ${tokenRecord.filePath}`);
    if (pairingSession) {
      const pairing = pairingSession.details();
      console.log(`Extension pairing code: ${pairing.code} (expires ${pairing.expiresAt}, one use, five attempts)`);
    }
  });
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
  return isExtensionOrigin(origin)
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function isExtensionOrigin(origin) {
  return typeof origin === 'string' && /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

function isLoopbackHost(value) {
  if (typeof value !== 'string') return false;
  try { return isLoopbackHostname(new URL(`http://${value}`).hostname); }
  catch { return false; }
}

function isLoopbackHostname(value) {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(String(value).toLowerCase());
}

function hasValidToken(value, requiredToken) {
  if (!requiredToken || typeof value !== 'string') return false;
  const supplied = Buffer.from(value);
  const expected = Buffer.from(requiredToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function setCors(origin, response) {
  if (typeof origin === 'string' && isAllowedOrigin(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
  }
  response.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type, x-hephaestus-token');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('cache-control', 'no-store');
}

function send(response, status, body) {
  response.statusCode = status;
  if (body === undefined) return response.end();
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}
