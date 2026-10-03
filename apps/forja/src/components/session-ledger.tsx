import { useEffect, useRef, useState } from "react";
import { authClient, signOut } from "@/lib/auth/client";
import { Button } from "./ui/button";
import { Panel } from "./panel";
import { IconLock } from "./icons";
import { listForgeSessions, revokeForgeSession, revokeOtherForgeSessions } from "@/lib/session/client";
import { sessionStillValid, summarizeUserAgent, type ListedSession } from "@/lib/session/view";
import { formatWhen } from "@/lib/utils";

export function SessionLedger() {
  const { data } = authClient.useSession();
  const currentId = data?.session?.id;
  const currentExpiry = data?.session?.expiresAt;
  const tokens = useRef(new Map<string, string>());
  const [rows, setRows] = useState<ListedSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const result = await listForgeSessions();
    if (!result.ok) {
      setError(result.reason);
      setRows([]);
      tokens.current.clear();
      return;
    }
    tokens.current = new Map(result.sessions.map((row) => [row.id, row.token]));
    setRows(
      result.sessions.map(({ token: _token, ...rest }) => rest),
    );
    setError(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function closeOne(id: string) {
    const token = tokens.current.get(id);
    if (!token) return;
    setBusy(true);
    if (id === currentId) {
      await signOut("/");
      return;
    }
    const result = await revokeForgeSession(token);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    await refresh();
  }

  async function closeOthers() {
    setBusy(true);
    const result = await revokeOtherForgeSessions();
    setBusy(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    await refresh();
  }

  return (
    <Panel className="mt-8 p-5">
      <p className="kicker">Sesiones</p>
      <h2 className="mt-2 font-display text-xl tracking-tight">Una identidad, varias fraguas</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Cookie de host, SameSite Lax. El token no se enseña. Quince minutos quietos cierran el taller.
      </p>
      {currentExpiry ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-subtle">
          <IconLock className="size-3.5 text-accent" />
          Esta sesión caduca {formatWhen(typeof currentExpiry === "string" ? currentExpiry : currentExpiry.toISOString())}.
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {rows.map((row) => {
          const current = row.id === currentId;
          const live = sessionStillValid(row.expiresAt);
          return (
            <li key={row.id} className="flex items-start justify-between gap-3 rounded-md bg-surface px-3 py-3 shadow-border">
              <div>
                <p className="text-sm font-medium">
                  {summarizeUserAgent(row.userAgent)}
                  {current ? " · esta" : ""}
                </p>
                <p className="mt-1 text-xs text-subtle">
                  {live ? `Hasta ${formatWhen(row.expiresAt)}` : "Caducada"}
                  {row.ipAddress ? ` · ${row.ipAddress}` : ""}
                </p>
              </div>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void closeOne(row.id)}>
                {current ? "Salir" : "Cerrar"}
              </Button>
            </li>
          );
        })}
      </ul>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy || rows.length < 2} onClick={() => void closeOthers()}>
          Cerrar las otras
        </Button>
      </div>
    </Panel>
  );
}
