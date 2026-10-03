import { sha256Hex } from "../kernel/hash.ts";

export type AppRole = "user" | "owner";

export const OWNER_STORAGE = "efesto.owner.v1";

export type OwnerState = {
  hash: string | null;
  unlocked: boolean;
};

const EMPTY: OwnerState = { hash: null, unlocked: false };

const listeners = new Set<() => void>();
let current: OwnerState = EMPTY;

function read(): OwnerState {
  if (typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(OWNER_STORAGE);
    if (!raw) return EMPTY;
    const row = JSON.parse(raw) as { hash?: unknown; unlocked?: unknown };
    const hash = typeof row.hash === "string" && row.hash.length >= 32 ? row.hash : null;
    return { hash, unlocked: Boolean(hash && row.unlocked) };
  } catch {
    return EMPTY;
  }
}

function emit(next: OwnerState) {
  current = next;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(OWNER_STORAGE, JSON.stringify(next));
    } catch {
      /* private forge */
    }
  }
  for (const listener of listeners) listener();
}

export function getOwnerState(): OwnerState {
  return current;
}

export function hydrateOwnerState() {
  const next = read();
  if (next.hash === current.hash && next.unlocked === current.unlocked) return current;
  current = next;
  return current;
}

export function subscribeOwner(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function roleOf(state: OwnerState): AppRole {
  return state.unlocked ? "owner" : "user";
}

export function isOwnerPage(path: string) {
  return (
    path.startsWith("/activity") ||
    path.startsWith("/settings") ||
    path.startsWith("/agentes") ||
    path.startsWith("/chat")
  );
}

export async function claimOwner(passphrase: string) {
  const value = passphrase.trim();
  if (value.length < 8) {
    return { ok: false as const, reason: "La frase del dueño debe tener al menos 8 caracteres." };
  }
  const hash = await sha256Hex(`efesto.owner:${value}`);
  emit({ hash, unlocked: true });
  return { ok: true as const };
}

export async function unlockOwner(passphrase: string) {
  const value = passphrase.trim();
  if (!current.hash) return claimOwner(value);
  const hash = await sha256Hex(`efesto.owner:${value}`);
  if (hash !== current.hash) {
    return { ok: false as const, reason: "Esa no es la frase de esta instancia." };
  }
  emit({ hash: current.hash, unlocked: true });
  return { ok: true as const };
}

export function lockOwner() {
  emit({ hash: current.hash, unlocked: false });
}

export function resetOwnerForTests() {
  current = EMPTY;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(OWNER_STORAGE);
    } catch {
      /* ignore */
    }
  }
}

if (typeof window !== "undefined") {
  hydrateOwnerState();
}
