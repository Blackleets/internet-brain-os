import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <nav aria-label="Primary">
        <a href="/" aria-current="page">Overview</a>
      </nav>
      <div className="app-workspace">
        <form role="search" aria-label="Command center">
          <label htmlFor="command">Comandos</label>
          <input id="command" type="search" placeholder="Buscar o ejecutarâ€¦" />
        </form>
        <main>{children}</main>
      </div>
    </div>
  );
}
