'use client';

import { Activity, Bot, Boxes, BrainCircuit, Command, FolderSearch, Gauge, Sparkles } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { connectionStore } from '../lib/session/connection-store';
import { StatusBadge } from './ui/status-badge';

const navigation = [
  { href: '/', label: 'Resumen', icon: Gauge, active: true },
  { label: 'Investigaciones', icon: FolderSearch },
  { label: 'Conocimiento', icon: BrainCircuit },
  { label: 'Agent Hub', icon: Bot },
  { label: 'Oportunidades', icon: Sparkles },
  { label: 'Automatizaciones', icon: Activity },
  { label: 'Sistema', icon: Boxes },
];

export function AppShell({ children }: { children: ReactNode }) {
  const connection = useSyncExternalStore(
    (listener) => connectionStore.subscribe(listener),
    () => connectionStore.get(),
    () => undefined,
  );
  const readiness = connection
    ? { state: 'healthy' as const, label: 'Kernel conectado' }
    : { state: 'unavailable' as const, label: 'Kernel sin conexión' };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <a className="app-brand" href="/" aria-label="Hephaestus, resumen">
          <span className="app-brand-mark" aria-hidden="true"><Sparkles size={20} /></span>
          <span>
            <strong>HEPHAESTUS</strong>
            <small>Intelligence Forge</small>
          </span>
        </a>
        <nav className="primary-navigation" aria-label="Primary">
          <p className="navigation-label">Espacios</p>
          {navigation.map(({ href, label, icon: Icon, active }) => (
            <a
              key={label}
              href={href}
              role="link"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              aria-disabled={href ? undefined : true}
              title={href ? undefined : 'Próximamente'}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-readiness">
          <p>Estado local</p>
          <div className="command-readiness">
            <StatusBadge state={readiness.state} label={readiness.label} />
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="command-bar">
          <form role="search" aria-label="Command center" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor="command">Comandos</label>
            <div className="command-input-wrap">
              <Command aria-hidden="true" size={18} />
              <input id="command" type="search" placeholder="Próximamente" disabled />
            </div>
          </form>
          <StatusBadge state={readiness.state} label={readiness.label} />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
