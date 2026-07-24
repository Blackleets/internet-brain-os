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
      opportunity: payload.opportunity?.status === 'opportunity' ? payload.opportunity.opportunity : undefined,
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

export async function listOpportunities(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/opportunities`, { headers: { 'x-hephaestus-token': apiToken } });
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Efesto Opportunity Inbox');
  }
  if (!response.ok) throw new LocalTransportError('KERNEL_REJECTED', `Local Kernel request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok || !Array.isArray(payload.opportunities)) {
    throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid Opportunity list');
  }
  return payload.opportunities;
}

export async function sendOpportunityFeedback(opportunityId, signal, options = {}) {
  const allowed = ['useful', 'saved', 'dismissed', 'not_interested'];
  if (typeof opportunityId !== 'string' || !allowed.includes(signal)) throw new LocalTransportError('INVALID_FEEDBACK', 'Opportunity feedback is invalid');
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/opportunities/${encodeURIComponent(opportunityId)}/feedback`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-hephaestus-token': apiToken }, body: JSON.stringify({ signal }),
    });
  } catch { throw new LocalTransportError('TRANSPORT', 'Unable to save private learning feedback'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', payload.error ?? `Local Kernel request failed with HTTP ${response.status}`);
  return payload.feedback;
}

export async function listGoals(options = {}) {
  return goalsRequest('GET', undefined, options);
}

export async function createGoal(goal, options = {}) {
  return goalsRequest('POST', goal, options);
}

export async function startGoalResearch(goalId, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/goals/${encodeURIComponent(goalId)}/missions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-hephaestus-token': apiToken },
      body: JSON.stringify({ agent: 'hermes', cadence: options.cadence ?? 'manual', confirmed: true }),
    });
  } catch { throw new LocalTransportError('TRANSPORT', 'Unable to reach Efesto Agent Hub'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', payload.error ?? `Local Kernel request failed with HTTP ${response.status}`);
  if (!payload.mission?.id) throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid mission');
  return payload.mission;
}

export async function listAgentMissions(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/agent-missions`, { headers: { 'x-hephaestus-token': apiToken } });
  } catch { throw new LocalTransportError('TRANSPORT', 'Unable to reach Efesto Agent Hub'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', payload.error ?? `Local Kernel request failed with HTTP ${response.status}`);
  if (!payload?.ok || !Array.isArray(payload.missions)) throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid mission list');
  return payload.missions;
}

export async function inspectModelForge(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/model-forge`, { headers: { 'x-hephaestus-token': apiToken } });
  } catch { throw new LocalTransportError('TRANSPORT', 'Unable to inspect the local Model Forge'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', `Local Kernel request failed with HTTP ${response.status}`);
  if (!payload?.forge || !Array.isArray(payload.forge.models)) throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid Model Forge status');
  return payload.forge;
}

async function goalsRequest(method, goal, options) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/goals`, {
      method,
      headers: { ...(method === 'POST' ? { 'content-type': 'application/json' } : {}), 'x-hephaestus-token': apiToken },
      ...(method === 'POST' ? { body: JSON.stringify(goal) } : {}),
    });
  } catch { throw new LocalTransportError('TRANSPORT', 'Unable to reach private Efesto Goals'); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', payload.error ?? `Local Kernel request failed with HTTP ${response.status}`);
  if (method === 'GET' && Array.isArray(payload.goals)) return payload.goals;
  if (method === 'POST' && payload.goal?.id) return payload.goal;
  throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid Goals response');
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

export async function getKernelStatus(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/status`);
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Hephaestus Kernel');
  }
  if (!response.ok) throw new LocalTransportError('KERNEL_REJECTED', `Local Kernel request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.ok || payload.kernel !== 'ready') {
    throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid status');
  }
  return {
    kernel: payload.kernel,
    hermes: payload.hermes,
    replayLab: payload.replayLab,
    ollama: payload.ollama,
    obsidian: payload.obsidian,
  };
}

export async function getEfestoBootstrapStatus(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/bootstrap/status`);
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the Efesto bootstrap service');
  }
  if (!response.ok) throw new LocalTransportError('KERNEL_REJECTED', `Efesto bootstrap request failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (payload?.schemaVersion !== 'efesto.bootstrap-status.v1' || !payload.overall || !payload.message) {
    throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid Efesto bootstrap status');
  }
  return payload;
}

export async function pairKernel(code, options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  if (!/^[A-Za-z2-9 -]{8,12}$/.test(normalizedCode)) {
    throw new LocalTransportError('INVALID_PAIRING_CODE', 'Enter the eight-character pairing code');
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/pair`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: normalizedCode }),
    });
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Hephaestus Kernel');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new LocalTransportError(payload.code ?? 'PAIRING_REJECTED', 'Pairing code was rejected or expired');
  }
  const payload = await response.json();
  return requireApiToken(payload?.apiToken);
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

// Devuelve el veredicto de admisión de un caso capturado: por qué el Kernel
// lo admitió (y su evidencia), para que el usuario lo vea en el popup.
export async function getCaseVerdict(caseId, options = {}) {
  if (typeof caseId !== 'string' || !caseId.startsWith('case:')) {
    throw new LocalTransportError('INVALID_CASE_ID', 'A valid case id is required');
  }
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiToken = requireApiToken(options.apiToken);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/browser/case/${encodeURIComponent(caseId)}`, {
      headers: { 'x-hephaestus-token': apiToken },
    });
  } catch {
    throw new LocalTransportError('TRANSPORT', 'Unable to reach the local Efesto Kernel');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LocalTransportError(payload.code ?? 'KERNEL_REJECTED', payload.error ?? `Local Kernel request failed with HTTP ${response.status}`);
  }
  if (!payload?.ok || !payload.case) {
    throw new LocalTransportError('INVALID_RESPONSE', 'Local Kernel returned an invalid case verdict');
  }
  return { case: payload.case, evidence: Array.isArray(payload.evidence) ? payload.evidence : [] };
}
