import { useEffect, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { shouldCloseIdle, shouldWarnIdle } from "@/lib/session/view";

export function SessionGuard() {
  const { user, isPending } = useCurrentUserState();
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    if (!user || isPending) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
      setWarning(false);
    };
    const tick = () => {
      if (shouldCloseIdle(last)) {
        void signOut("/");
        return;
      }
      setWarning(shouldWarnIdle(last));
    };
    const timer = window.setInterval(tick, 1000);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    const onVis = () => {
      if (!document.hidden) bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, isPending]);

  if (!user || !warning) return null;

  return (
    <div className="border-b border-border bg-surface px-4 py-2 text-sm text-muted md:px-8">
      Esta sesión se cierra por inactividad. Mueve el puntero para seguir en el taller.
    </div>
  );
}
