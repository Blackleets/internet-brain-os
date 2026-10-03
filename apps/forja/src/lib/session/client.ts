import { authClient } from "@/lib/auth/client";
import type { ListedSession } from "./view.ts";

type RemoteSession = {
  id?: unknown;
  token?: unknown;
  expiresAt?: unknown;
  createdAt?: unknown;
  ipAddress?: unknown;
  userAgent?: unknown;
};

function asIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 8) return value;
  return "";
}

function asSession(row: RemoteSession): (ListedSession & { token: string }) | null {
  if (typeof row.id !== "string" || typeof row.token !== "string") return null;
  const createdAt = asIso(row.createdAt);
  const expiresAt = asIso(row.expiresAt);
  if (!createdAt || !expiresAt) return null;
  return {
    id: row.id,
    token: row.token,
    createdAt,
    expiresAt,
    ipAddress: typeof row.ipAddress === "string" ? row.ipAddress : null,
    userAgent: typeof row.userAgent === "string" ? row.userAgent : null,
  };
}

export async function listForgeSessions() {
  const result = await authClient.listSessions();
  if (result.error) {
    return { ok: false as const, reason: result.error.message || "No se pudieron leer las sesiones.", sessions: [] as (ListedSession & { token: string })[] };
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true as const,
    sessions: rows.map((row) => asSession(row as RemoteSession)).filter((row): row is ListedSession & { token: string } => Boolean(row)),
  };
}

export async function revokeForgeSession(token: string) {
  const result = await authClient.revokeSession({ token });
  if (result.error) return { ok: false as const, reason: result.error.message || "No se pudo cerrar esa sesión." };
  return { ok: true as const };
}

export async function revokeOtherForgeSessions() {
  const result = await authClient.revokeOtherSessions();
  if (result.error) return { ok: false as const, reason: result.error.message || "No se pudieron cerrar las otras sesiones." };
  return { ok: true as const };
}
