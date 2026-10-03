import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { EmptyState } from "./empty-state";
import { IconLock } from "./icons";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function OwnerOnly({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <p className="text-sm text-muted">Comprobando identidad…</p>;
  }
  if (!user) {
    return (
      <EmptyState
        icon={<IconLock className="size-5" />}
        title="Taller del dueño"
        body="Google, X o correo. Quien forja no necesita cuenta. El Kernel, las claves y los agentes sí."
        action={
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            Entrar
          </Link>
        }
      />
    );
  }
  return <>{children}</>;
}
