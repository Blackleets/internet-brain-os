/**
 * Extension ↔ Kernel NotificationGateway delivery for SUPPORT Finds only.
 * Completes the half-built path: Kernel queues find:supported:* receipts;
 * the extension must OS-notify those — not invent a second Find mint path.
 */

/**
 * Shared shape gate for Kernel SUPPORT Find receipts (state-agnostic).
 * Evidence-only, unsupported leads, and Completado fakes never pass.
 */
function isKernelSupportedFindReceipt(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.sourceType !== 'opportunity') return false;
  const dedupeKey = typeof item.dedupeKey === 'string' ? item.dedupeKey.trim() : '';
  if (!dedupeKey.startsWith('find:supported:')) return false;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!id || !title) return false;
  const evidenceIds = Array.isArray(item.evidenceIds)
    ? item.evidenceIds.filter((value) => typeof value === 'string' && value.trim())
    : [];
  if (!evidenceIds.length) return false;
  return true;
}

/**
 * Fail-closed OS-notify admission: unread find:supported:* receipts only.
 * Mark-read must not keep re-firing chrome.notifications every alarm tick.
 */
export function selectKernelSupportedFindNotifications(notifications = []) {
  return (Array.isArray(notifications) ? notifications : []).filter(
    (item) => isKernelSupportedFindReceipt(item) && item.state === 'unread',
  );
}

/**
 * Covering pool for watchtower Find suppression: unread OR read (and dismissed).
 * Click → markNotificationRead drops state to read; a later watchtower revision
 * transition must still see Kernel already covered this Evidence — otherwise
 * watchtower double-fires kind:'find' after Kernel already OS-notified.
 */
export function selectKernelSupportedFindCoveringNotifications(notifications = []) {
  return (Array.isArray(notifications) ? notifications : []).filter(isKernelSupportedFindReceipt);
}

/** Skip OS notify for Kernel receipts already delivered locally (avoid minute re-spam). */
export function undeliveredKernelSupportedFindNotifications(notifications = [], deliveredIds = []) {
  const seen = new Set(
    (Array.isArray(deliveredIds) ? deliveredIds : [])
      .filter((value) => typeof value === 'string' && value.trim())
      .map((value) => value.trim()),
  );
  return selectKernelSupportedFindNotifications(notifications).filter((item) => !seen.has(item.id));
}

export function rememberDeliveredKernelNotificationIds(previous = [], newlyDelivered = [], limit = 100) {
  const next = [];
  const seen = new Set();
  for (const id of [...newlyDelivered, ...(Array.isArray(previous) ? previous : [])]) {
    if (typeof id !== 'string' || !id.trim() || seen.has(id.trim())) continue;
    seen.add(id.trim());
    next.push(id.trim());
    if (next.length >= limit) break;
  }
  return next;
}

/**
 * Kernel Find receipts whose evidenceIds intersect this mission's SUPPORT rows.
 * Used to suppress duplicate watchtower kind:'find' OS notify for the same Evidence.
 * State-agnostic: mark-read must not un-cover.
 */
export function kernelFindsCoveringMission(notifications = [], mission) {
  const evidenceIds = new Set();
  for (const entry of Array.isArray(mission?.verificationResults) ? mission.verificationResults : []) {
    if (!entry || typeof entry !== 'object' || entry.supported !== true) continue;
    const evidenceId = typeof entry.evidenceId === 'string' ? entry.evidenceId.trim() : '';
    if (evidenceId) evidenceIds.add(evidenceId);
  }
  if (!evidenceIds.size) return [];
  return selectKernelSupportedFindCoveringNotifications(notifications).filter((item) =>
    (Array.isArray(item.evidenceIds) ? item.evidenceIds : []).some((id) => evidenceIds.has(String(id).trim())),
  );
}

export function chromeNotificationIdForKernelNotification(notificationId) {
  return `efesto-kernel-notification:${String(notificationId ?? '').trim()}`;
}

export function parseKernelNotificationId(chromeNotificationId) {
  const prefix = 'efesto-kernel-notification:';
  if (typeof chromeNotificationId !== 'string' || !chromeNotificationId.startsWith(prefix)) return null;
  const id = chromeNotificationId.slice(prefix.length).trim();
  return id || null;
}

/**
 * Suppress watchtower Find/forged OS notify when Kernel already has a covering
 * SUPPORT Find receipt for this mission's Evidence.
 * listOpportunities catch→[] makes presentWatchtowerAviso emit kind:'forged' even
 * when verificationResults + NotificationGateway covering prove SUPPORT Finds —
 * suppressing only kind:'find' then double-fires Kernel Find + forged OS notify.
 * Failed / attention / forged-without-covering still notify. If Kernel gateway was
 * unreachable (covering empty), watchtower remains the Find fallback.
 */
export function shouldOsNotifyWatchtowerAviso(aviso, { coveringKernelFindNotifications = [] } = {}) {
  if (!aviso?.notify) return false;
  if (
    coveringKernelFindNotifications.length > 0
    && (aviso.kind === 'find' || aviso.kind === 'forged')
  ) {
    return false;
  }
  return true;
}

/**
 * Lock-screen-safe OS notify copy (ARCHITECTURE.md + extension README).
 * Kernel receipts may carry Find titles for in-app / Finds workspace honesty,
 * but chrome.notifications must never echo Goal titles, sources, or findings
 * onto a locked or shared screen — same generic contract as Mission Watchtower.
 * Click still opens Finds where the real title is visible.
 */
export function presentKernelSupportedFindOsNotify(_notification = {}) {
  return {
    title: 'Efesto finished forging',
    message: 'A Find passed Kernel SUPPORT. Open Efesto to inspect.',
  };
}
