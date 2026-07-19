export const DEFAULT_KERNEL_BASE_URL = 'http://127.0.0.1:4000';
export const DEFAULT_TIMEOUT_MS = 10000;

export class LocalTransportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'LocalTransportError';
    this.code = code;
  }
}

export async function sendPageContext(context, options = {}) {
  if (context?.schemaVersion !== 'hephaestus.page-context.v1') {
    throw new LocalTransportError('INVALID_CONTEXT', 'Unsupported page context payload');
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/browser/page-context`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hephaestus-token': apiToken },
      body: JSON.stringify({ ...context, targetCaseId: options.targetCaseId }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LocalTransportError(
        response.status === 404 || response.status === 503 ? 'KERNEL_UNAVAILABLE' : 'KERNEL_REJECTED',
        `Local Kernel request failed with HTTP ${response.status}`,
      );
    }

    const payload = await response.json();
    if (!payload || payload.ok !== true || typeof payload.receiptId !== 'string'
      || typeof payload.caseId !== 'string' || typeof payload.evidenceId !== 'string') {
      throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid response');
    }

    return {
      ok: true,
      receiptId: payload.receiptId,
      caseId: payload.caseId,
      evidenceId: payload.evidenceId,
      obsidianUpdated: Boolean(payload.obsidianNotes),
      intelligenceStatus: payload.intelligence?.status,
    };
  } catch (error) {
    if (error instanceof LocalTransportError) throw error;
    if (controller.signal.aborted) {
      throw new LocalTransportError('TIMEOUT', `Local Kernel request timed out after ${timeoutMs}ms`);
    }
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Hephaestus Kernel');
  } finally {
    clearTimeout(timer);
  }
}

export async function listCases(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/cases`, { headers: { 'x-hephaestus-token': apiToken } });
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Hephaestus Kernel');
  }
  if (!response.ok) throw new LocalTransportError('KERNEL_REJECTED', `Local Kernel request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok || !Array.isArray(payload.cases)) {
    throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid Case list');
  }
  return payload.cases;
}

function requireApiToken(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 512) {
    throw new LocalTransportError('AUTH_REQUIRED', 'Enter the local Kernel token in the extension');
  }
  return value;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new LocalTransportError('INVALID_ENDPOINT', 'Kernel endpoint must use HTTP on a loopback host');
  }
  return url.href.replace(/\/$/, '');
}
