// Pure helpers for the v2 popup (unit-tested without a browser).
export const INSTALLED_KERNEL_URL = 'http://127.0.0.1:4310';

export function hasToken(stored) {
  return typeof stored?.kernelApiToken === 'string' && stored.kernelApiToken.length >= 32;
}

export function kernelBaseFrom(stored) {
  return typeof stored?.kernelBaseUrl === 'string' && stored.kernelBaseUrl ? stored.kernelBaseUrl : INSTALLED_KERNEL_URL;
}

export function isAnalyzablePage(url) {
  try { const { protocol } = new URL(url); return protocol === 'http:' || protocol === 'https:'; } catch { return false; }
}

export function displayHost(url) {
  try { const u = new URL(url); return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`; } catch { return ''; }
}

const STOP = new Set(['the', 'and', 'for', 'with', 'que', 'para', 'con', 'los', 'las', 'del', 'una', 'uno', 'des', 'les', 'und', 'der', 'die', 'das', 'com', 'por']);
export function goalPayload(title) {
  const clean = String(title ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
  if (clean.length < 3) return undefined;
  const keywords = [...new Set(clean.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && !STOP.has(w)))].slice(0, 8);
  return { title: clean, keywords, priority: 2 };
}
