// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';
import { connectionStore } from '../lib/session/connection-store';

afterEach(() => {
  cleanup();
  connectionStore.clear();
});

describe('AppShell', () => {
  it('exposes navigation, command entry, and main content landmarks', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Resumen' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Resumen', 'Investigaciones', 'Conocimiento', 'Agent Hub', 'Oportunidades', 'Automatizaciones', 'Sistema']) {
      expect(screen.getByRole('link', { name }).getAttribute('aria-label')).toBe(name);
    }
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    expect(screen.getByLabelText('Comandos')).toBeTruthy();
    expect(screen.getAllByText('Kernel sin conexión')).toHaveLength(2);
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });

  it('updates persistent readiness badges when the local connection changes', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);

    act(() => connectionStore.set({ baseUrl: 'http://127.0.0.1:4000', token: 'token-local' }));
    expect(screen.getAllByText('Kernel conectado')).toHaveLength(2);

    act(() => connectionStore.clear());
    expect(screen.getAllByText('Kernel sin conexión')).toHaveLength(2);
  });
});
