/**
 * Extension ↔ Kernel NotificationGateway delivery for SUPPORT Finds only.
 * Completes the half-built path: Kernel queues find:supported:* receipts;
 * the extension must OS-notify those — not invent a second Find mint path.
 */

/**
 * Fail-closed: only unread opportunity notifications with dedupeKey
 * `find:supported:*` and at least one evidenceId become OS notifies.
 * Evidence-only, unsupported leads, and Completado fakes never pass.
 */
export function selectKernelSupportedFindNotifications(notifications = []) {
  return (Array.isArray(notifications) ? notifications : []).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    if (item.state !== 'unread') return false;
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
  });
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
 */
export function kernelFindsCoveringMission(notifications = [], mission) {
  const evidenceIds = new Set();
  for (const entry of Array.isArray(mission?.verificationResults) ? mission.verificationResults : []) {
    if (!entry || typeof entry !== 'object' || entry.supported !== true) continue;
    const evidenceId = typeof entry.evidenceId === 'string' ? entry.evidenceId.trim() : '';
    if (evidenceId) evidenceIds.add(evidenceId);
  }
  if (!evidenceIds.size) return [];
  return selectKernelSupportedFindNotifications(notifications).filter((item) =>
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
 * Suppress watchtower kind:'find' OS notify only when Kernel already has a covering
 * SUPPORT Find receipt for this mission's Evidence. Failed / forged-without-finds
 * still notify. If Kernel gateway was unreachable, watchtower remains the Find fallback.
 */
export function shouldOsNotifyWatchtowerAviso(aviso, { coveringKernelFindNotifications = [] } = {}) {
  if (!aviso?.notify) return false;
  if (aviso.kind === 'find' && coveringKernelFindNotifications.length > 0) return false;
  return true;
}

export function presentKernelSupportedFindOsNotify(notification = {}) {
  const title = typeof notification.title === 'string' && notification.title.trim()
    ? notification.title.trim().slice(0, 160)
    : 'Kernel SUPPORT Find';
  const body = typeof notification.body === 'string' && notification.body.trim()
    ? notification.body.trim().slice(0, 180)
    : 'Find passed Kernel SUPPORT. Open Efesto to inspect.';
  return { title, message: body };
}
