export function interactiveMissionConfirmationActor(origin, allowedDashboardOrigins = new Set()) {
  if (typeof origin !== 'string') return undefined;
  if (/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
    return { actorType: 'interactive_user', decidedBy: 'extension-ui' };
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || allowedDashboardOrigins.has(origin)) {
    return { actorType: 'interactive_user', decidedBy: 'dashboard-ui' };
  }
  return undefined;
}
