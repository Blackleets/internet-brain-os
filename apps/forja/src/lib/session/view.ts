export const SESSION_IDLE_MS = 15 * 60 * 1000;
export const SESSION_IDLE_WARN_MS = 2 * 60 * 1000;

export type ListedSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export function summarizeUserAgent(value: string | null | undefined) {
  const ua = (value ?? "").trim();
  if (!ua) return "Navegador desconocido";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  if (/Mobile/i.test(ua)) return "Móvil";
  return "Navegador";
}

export function sessionStillValid(expiresAt: string, now = Date.now()) {
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires > now;
}

export function idleRemaining(lastActivity: number, now = Date.now()) {
  return Math.max(0, lastActivity + SESSION_IDLE_MS - now);
}

export function shouldWarnIdle(lastActivity: number, now = Date.now()) {
  const left = idleRemaining(lastActivity, now);
  return left > 0 && left <= SESSION_IDLE_WARN_MS;
}

export function shouldCloseIdle(lastActivity: number, now = Date.now()) {
  return idleRemaining(lastActivity, now) <= 0;
}
