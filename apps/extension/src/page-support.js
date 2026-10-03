/**
 * Pure page-support helpers for the mounted extension popup (popup.html →
 * popup.js capture + unsupported-page-guard.js). No DOM, no chrome.* access.
 *
 * Content scripts only run on http(s) pages, and Chrome/Edge never inject
 * them into their extension stores. A tab opened before Efesto was installed
 * or reloaded also has no receiver. In both cases chrome.tabs.sendMessage
 * rejects with a raw "Receiving end does not exist" error that must not be
 * shown to the user as-is.
 */

const PROTECTED_STORE_PAGES = Object.freeze([
  { host: 'chromewebstore.google.com', pathPrefix: '/' },
  { host: 'chrome.google.com', pathPrefix: '/webstore' },
  { host: 'microsoftedge.microsoft.com', pathPrefix: '/addons' },
]);

export const RELOAD_PAGE_COPY = 'Reload this page so Efesto can read it. Pages opened before Efesto was installed or updated need one refresh.';
export const PROTECTED_PAGE_COPY = 'Open a normal public website to use page analysis. Missions, Finds, Hermes, and Obsidian remain available.';

export function isSupportedPublicPage(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) return false;
    return !isProtectedStorePage(parsed);
  } catch {
    return false;
  }
}

export function isMissingReceiverMessage(message) {
  return typeof message === 'string' && (
    message.includes('Receiving end does not exist')
    || message.includes('Could not establish connection')
  );
}

/** User-facing copy for a failed page capture; never echoes raw missing-receiver errors. */
export function captureFailureMessage(error, url) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (isMissingReceiverMessage(message)) {
    return isSupportedPublicPage(url) ? RELOAD_PAGE_COPY : PROTECTED_PAGE_COPY;
  }
  return message || 'Unable to analyze page';
}

function isProtectedStorePage(parsed) {
  const host = parsed.hostname.toLowerCase();
  return PROTECTED_STORE_PAGES.some((page) => host === page.host
    && (page.pathPrefix === '/' || parsed.pathname === page.pathPrefix || parsed.pathname.startsWith(`${page.pathPrefix}/`)));
}
