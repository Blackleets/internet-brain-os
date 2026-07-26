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
  it('exposes only Phase 1 navigation and marks future spaces as unavailable', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const overview = screen.getByRole('link', { name: 'Resumen' });
    expect(overview.getAttribute('href')).toBe('/');
    expect(overview.getAttribute('aria-current')).toBe('page');
    for (const name of ['Investigaciones', 'Conocimiento', 'Agent Hub', 'Oportunidades', 'Automatizaciones', 'Sistema']) {
      const unavailable = screen.getByRole('link', { name });
      expect(unavailable.hasAttribute('href')).toBe(false);
      expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    }
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    const command = screen.getByLabelText('Comandos') as HTMLInputElement;
    expect(command.disabled).toBe(true);
    expect(command.placeholder).toBe('Próximamente');
    expect(screen.queryByText('Ctrl K')).toBeNull();
    expect(screen.getAllByText('Kernel sin conexión')).toHaveLength(2);
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
    expect(screen.getAllByText('Kernel conectado')).toHaveLength(2);

    act(() => connectionStore.clear());
    expect(screen.getAllByText('Kernel sin conexión')).toHaveLength(2);
  });
});
