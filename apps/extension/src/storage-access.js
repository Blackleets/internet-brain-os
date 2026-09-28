/**
 * chrome.storage.local holds the Kernel API token and is exposed to content scripts by
 * default. Content scripts run inside every http(s) page renderer and never read storage,
 * so restrict local to trusted contexts (service worker, popup). Pairing still persists
 * across restarts (unlike storage.session). Chrome added setAccessLevel for `local` in 2025
 * (chromium a8f1f33); older builds lack or reject it, which must never break startup.
 * @returns {Promise<'restricted' | 'unsupported'>}
 */
export async function restrictLocalStorageToTrustedContexts(storage) {
  const local = storage?.local;
  if (typeof local?.setAccessLevel !== 'function') return 'unsupported';
  try {
    await local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
    return 'restricted';
  } catch {
    return 'unsupported';
  }
}
