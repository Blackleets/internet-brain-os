'use client';

import { Activity, Bot, Boxes, BrainCircuit, FolderSearch, Gauge, Sparkles } from 'lucide-react';
import { useSyncExternalStore, type ReactNode } from 'react';
import { connectionStore } from '../lib/session/connection-store';
import { StatusBadge } from './ui/status-badge';

const primaryNavigation = [
  { href: '/', label: 'Resumen', icon: Gauge, active: true },
];

// Phase 2 spaces are not shipped in Phase 1. They are shown as an explicit,
// honest roadmap so the sidebar communicates intent without faking product
// surface. These are non-interactive: no href, no aria-disabled pretending to
// be a link, just a visible "Próximamente" tag.
const roadmap = [
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
          {primaryNavigation.map(({ href, label, icon: Icon, active }) => (
            <a
              key={label}
              href={href}
              role="link"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-roadmap" aria-label="Roadmap (fase 2)">
          <p className="navigation-label">Roadmap</p>
          <ul>
            {roadmap.map(({ label, icon: Icon }) => (
              <li key={label} className="roadmap-item">
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
                <span className="roadmap-tag">Próximamente</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="sidebar-readiness">
          <p>Estado local</p>
          <div className="command-readiness">
            <StatusBadge state={readiness.state} label={readiness.label} />
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="workspace-header">
          <p className="workspace-context">Panel de control local</p>
          <StatusBadge state={readiness.state} label={readiness.label} />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
