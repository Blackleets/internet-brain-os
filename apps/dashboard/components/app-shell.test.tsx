// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';
import { connectionStore } from '../lib/session/connection-store';

afterEach(() => {
  cleanup();
  connectionStore.clear();
});

describe('AppShell', () => {
  it('exposes working in-page navigation and command search', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const overview = screen.getByRole('link', { name: 'Home' });
    expect(overview.getAttribute('href')).toBe('#overview');
    expect(overview.getAttribute('aria-current')).toBe('page');
    for (const name of ['Cerebro IA', 'Investigación', 'Conocimiento', 'Agentes', 'Oportunidades', 'Automatizaciones', 'Relaciones', 'Sistema']) {
      const link = screen.getByRole('link', { name });
      expect(link.getAttribute('href')?.startsWith('#')).toBe(true);
      expect(link.getAttribute('aria-disabled')).toBeNull();
    }
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    const command = screen.getByLabelText('Comandos') as HTMLInputElement;
    expect(command.disabled).toBe(false);
    expect(command.placeholder).toContain('Pregunta');
    expect(screen.getByText('Ctrl + K')).toBeTruthy();
    expect(screen.getByText('Kernel sin conexión')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });

  it('prevents command submission from reloading or clearing the live session', () => {
    connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token: 'token-local' });
    render(<AppShell><h1>Overview</h1></AppShell>);

    expect(fireEvent.submit(screen.getByRole('search', { name: 'Command center' }))).toBe(false);
    expect(connectionStore.get()?.token).toBe('token-local');
  });

  it('updates persistent readiness badges when the local connection changes', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);

    act(() => connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token: 'token-local' }));
    expect(screen.getByText('Kernel conectado')).toBeTruthy();

    act(() => connectionStore.clear());
    expect(screen.getByText('Kernel sin conexión')).toBeTruthy();
  });
});
