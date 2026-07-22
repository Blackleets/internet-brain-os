export const AUTO_CAPTURE_COOLDOWN_MS = 30 * 60 * 1000;

const SENSITIVE_PATH = /\/(login|log-in|signin|sign-in|checkout|payment|billing|wallet|bank|account|settings|messages?|inbox)(\/|$)/i;
const SENSITIVE_QUERY = /^(token|access_token|auth|authorization|code|password|secret|session|key)$/i;

export function normalizePublicOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function evaluateAutoCapture(context, options = {}) {
  let url;
  try {
    url = new URL(context?.url);
  } catch {
    return { allowed: false, reason: 'invalid_url' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) return { allowed: false, reason: 'unsupported_scheme' };
  if (!Array.isArray(options.allowedOrigins) || !options.allowedOrigins.includes(url.origin)) {
    return { allowed: false, reason: 'site_not_authorized' };
  }
  if (SENSITIVE_PATH.test(url.pathname)) return { allowed: false, reason: 'sensitive_path' };
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY.test(key)) return { allowed: false, reason: 'sensitive_query' };
  }
  if (context?.selection) return { allowed: false, reason: 'selection_present' };
  if (!String(context?.visibleText ?? '').trim()) return { allowed: false, reason: 'empty_page' };

  const lastCapturedAt = Number(options.lastCapturedAt ?? 0);
  const now = Number(options.now ?? Date.now());
  if (lastCapturedAt > 0 && now - lastCapturedAt < (options.cooldownMs ?? AUTO_CAPTURE_COOLDOWN_MS)) {
    return { allowed: false, reason: 'cooldown' };
  }

  url.hash = '';
  return { allowed: true, safeUrl: url.href };
}
