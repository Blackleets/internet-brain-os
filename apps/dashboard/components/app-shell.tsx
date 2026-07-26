import { Activity, Bot, Boxes, BrainCircuit, Command, FolderSearch, Gauge, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from './ui/status-badge';

const navigation = [
  { href: '/', label: 'Resumen', icon: Gauge, active: true },
  { href: '#investigaciones', label: 'Investigaciones', icon: FolderSearch },
  { href: '#conocimiento', label: 'Conocimiento', icon: BrainCircuit },
  { href: '#agentes', label: 'Agent Hub', icon: Bot },
  { href: '#oportunidades', label: 'Oportunidades', icon: Sparkles },
  { href: '#automatizaciones', label: 'Automatizaciones', icon: Activity },
  { href: '#sistema', label: 'Sistema', icon: Boxes },
];

export function AppShell({ children }: { children: ReactNode }) {
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
            <a key={label} href={href} aria-label={label} aria-current={active ? 'page' : undefined}>
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-readiness">
          <p>Estado local</p>
          <div className="command-readiness">
            <StatusBadge state="unavailable" label="Kernel sin conexión" />
          </div>
          <div className="mobile-readiness" data-testid="mobile-readiness">
            <StatusBadge state="unavailable" label="Kernel sin conexión" />
          </div>
        </div>
      </aside>
      <div className="app-workspace">
        <header className="command-bar">
          <form role="search" aria-label="Command center">
            <label htmlFor="command">Comandos</label>
            <div className="command-input-wrap">
              <Command aria-hidden="true" size={18} />
              <input id="command" type="search" placeholder="Buscar o ejecutar…" />
              <kbd aria-hidden="true">Ctrl K</kbd>
            </div>
          </form>
          <StatusBadge state="unavailable" label="Kernel sin conexión" />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
