/**
 * Sender policy for the extension background runtime.onMessage router.
 *
 * Content scripts run inside every http(s) page renderer, so Chrome treats their
 * messages as less trustworthy than extension pages. Privileged commands (Auto Radar
 * control, Kernel URL/token config, forwarding page context with the Kernel token) are
 * only accepted from this extension's own pages (popup) — never from a tab sender.
 * The content script may only announce page readiness.
 */

export const EXTENSION_PAGE_MESSAGES = Object.freeze([
  'EFESTO_AUTO_RADAR_TOGGLE',
  'EFESTO_AUTO_RADAR_GET_STATE',
  'EFESTO_AUTO_RADAR_SET_STATE',
  'EFESTO_AUTO_RADAR_UPDATE_CONFIG',
  'HEPHAESTUS_SEND_PAGE_CONTEXT',
]);

export const CONTENT_SCRIPT_MESSAGES = Object.freeze(['EFESTO_PUBLIC_PAGE_READY']);

export function isExtensionPageSender(sender, runtimeId) {
  return Boolean(typeof runtimeId === 'string' && runtimeId
    && sender?.id === runtimeId
    && !sender.tab
    && typeof sender.url === 'string'
    && sender.url.startsWith(`chrome-extension://${runtimeId}/`));
}

export function isContentScriptSender(sender, runtimeId) {
  return Boolean(typeof runtimeId === 'string' && runtimeId
    && sender?.id === runtimeId
    && Number.isInteger(sender.tab?.id));
}

/** 'allow' | 'deny' | 'ignore' (unknown message types are not ours to answer). */
export function runtimeMessageDecision(message, sender, runtimeId) {
  const type = message?.type;
  if (EXTENSION_PAGE_MESSAGES.includes(type)) return isExtensionPageSender(sender, runtimeId) ? 'allow' : 'deny';
  if (CONTENT_SCRIPT_MESSAGES.includes(type)) return isContentScriptSender(sender, runtimeId) ? 'allow' : 'deny';
  return 'ignore';
}
