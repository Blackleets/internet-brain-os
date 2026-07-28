'use client';

import {
  Activity, Bell, Bot, Boxes, BrainCircuit, Command, FolderSearch,
  Gauge, Network, Search, Settings, Sun, Workflow,
} from 'lucide-react';
import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { connectionStore } from '../lib/session/connection-store';
import { StatusBadge } from './ui/status-badge';

const navigation = [
  { href: '#overview', label: 'Home', icon: Gauge },
  { href: '#intelligence', label: 'Cerebro IA', icon: BrainCircuit },
  { href: '#investigations', label: 'Investigación', icon: FolderSearch },
  { href: '#knowledge', label: 'Conocimiento', icon: Boxes },
  { href: '#agents', label: 'Agentes', icon: Bot },
  { href: '#automations', label: 'Automatizaciones', icon: Workflow },
  { href: '#graph', label: 'Relaciones', icon: Network },
  { href: '#system', label: 'Sistema', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [command, setCommand] = useState('');
  const connection = useSyncExternalStore(
    (listener) => connectionStore.subscribe(listener),
    () => connectionStore.get(),
    () => undefined,
  );
  const readiness = connection
    ? { state: 'healthy' as const, label: 'Kernel conectado' }
    : { state: 'unavailable' as const, label: 'Kernel sin conexión' };

  function runCommand(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = command.trim().toLocaleLowerCase('es');
    const target = value.includes('agente') ? 'agents'
      : value.includes('automat') ? 'automations'
      : value.includes('relac') || value.includes('grafo') ? 'graph'
      : value.includes('conoc') || value.includes('entidad') ? 'knowledge'
      : value.includes('sistema') || value.includes('estado') ? 'system'
      : value.includes('invest') || value.includes('caso') ? 'investigations'
      : 'overview';
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="app-brand" href="#overview" aria-label="Internet Brain OS, inicio">
          <span className="app-brand-mark" aria-hidden="true"><BrainCircuit size={28} /></span>
          <span>
            <strong>INTERNET <em>BRAIN OS</em></strong>
            <small>Your Intelligent Operating System for the Internet.</small>
          </span>
        </a>
        <form role="search" aria-label="Command center" onSubmit={runCommand}>
          <label htmlFor="command">Comandos</label>
          <div className="command-input-wrap">
            <Search aria-hidden="true" size={17} />
            <input
              id="command"
              type="search"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Pregunta, investiga, analiza cualquier cosa..."
            />
            <kbd>Ctrl + K</kbd>
            <button type="submit" aria-label="Ejecutar comando"><Command size={17} /></button>
          </div>
        </form>
        <div className="topbar-actions" aria-label="Controles">
          <button type="button" aria-label="Notificaciones"><Bell size={18} /></button>
          <button type="button" aria-label="Tema visual"><Sun size={18} /></button>
          <div className="profile-chip"><span>B</span><strong>Blackleets<small>Founder</small></strong></div>
        </div>
      </header>
      <aside className="app-sidebar">
        <div className="sidebar-product"><strong>HEPHAESTUS</strong><small>v1.0.0</small></div>
        <nav className="primary-navigation" aria-label="Primary">
          {navigation.map(({ href, label, icon: Icon }, index) => (
            <a
              key={label}
              href={href}
              role="link"
              aria-label={label}
              aria-current={index === 0 ? 'page' : undefined}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-readiness">
          <p><Activity size={13} /> Estado local</p>
          <div className="command-readiness">
            <StatusBadge state={readiness.state} label={readiness.label} />
          </div>
          <strong>{connection ? '100%' : '0%'}</strong>
        </div>
      </aside>
      <div className="app-workspace">
        <main>{children}</main>
      </div>
    </div>
  );
}
