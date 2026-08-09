import { parseGoalSurface, parseGoalSurfaces } from './goal-surface-contract.js';
import { DEFAULT_KERNEL_BASE_URL, DEFAULT_TIMEOUT_MS, LocalTransportError } from './local-transport.js';

const MAX_TIMEOUT_MS = 120000;

export async function listGoalSurfaces(options = {}) {
  return readSharedGoalTruth('/api/goal-surfaces', parseGoalSurfaces, options);
}

export async function getGoalSurface(goalId, options = {}) {
  const normalizedGoalId = requireGoalId(goalId);
  return readSharedGoalTruth(`/api/goal-surfaces/${encodeURIComponent(normalizedGoalId)}`, parseGoalSurface, options);
}

async function readSharedGoalTruth(path, parse, options) {
  const baseUrl = normalizeLoopbackBaseUrl(options.baseUrl ?? DEFAULT_KERNEL_BASE_URL);
  const apiToken = requireApiToken(options.apiToken);
  const timeoutMs = boundedTimeout(options.timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method: 'GET',
      headers: { 'x-hephaestus-token': apiToken },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new LocalTransportError(
        typeof payload.code === 'string' ? payload.code : 'KERNEL_REJECTED',
        typeof payload.error === 'string' ? payload.error : `Local Kernel request failed with HTTP ${response.status}`,
      );
    }
    return parse(payload);
  } catch (error) {
    if (error instanceof LocalTransportError || error?.name === 'GoalSurfaceContractError') throw error;
    if (controller.signal.aborted) {
      throw new LocalTransportError('TIMEOUT', `Shared Goal Truth request timed out after ${timeoutMs}ms`);
    }
    throw new LocalTransportError('TRANSPORT', 'Unable to reach Shared Goal Truth on the local Efesto Kernel');
  } finally {
    clearTimeout(timer);
  }
}

function requireGoalId(value) {
  if (typeof value !== 'string') throw new LocalTransportError('INVALID_GOAL_ID', 'A valid Goal id is required');
  const normalized = value.trim();
  if (!normalized || normalized.length > 240 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new LocalTransportError('INVALID_GOAL_ID', 'A valid Goal id is required');
  }
  return normalized;
}

function requireApiToken(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 512) {
    throw new LocalTransportError('AUTH_REQUIRED', 'Enter the local Kernel token in the extension');
  }
  return value;
}

function normalizeLoopbackBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new LocalTransportError('INVALID_ENDPOINT', 'Kernel endpoint must use HTTP on a loopback host');
  }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new LocalTransportError('INVALID_ENDPOINT', 'Kernel endpoint must use HTTP on a loopback host');
  }
  return url.href.replace(/\/$/, '');
}

function boundedTimeout(value) {
  if (value === undefined) return DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(value) || value < 1) throw new LocalTransportError('INVALID_TIMEOUT', 'Shared Goal Truth timeout is invalid');
  return Math.min(Math.floor(value), MAX_TIMEOUT_MS);
}
