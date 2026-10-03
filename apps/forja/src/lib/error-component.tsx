import type { ErrorComponentProps } from "@tanstack/react-router";
import { IconAlert } from "@/components/icons";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-fg">
      <span className="text-danger" aria-hidden="true">
        <IconAlert className="size-10" />
      </span>
      <h1 className="font-display text-lg">Algo falló</h1>
      <p className="max-w-md text-sm break-words text-muted">
        {error.message || "Error inesperado. Recarga la página."}
      </p>
    </main>
  );
}
