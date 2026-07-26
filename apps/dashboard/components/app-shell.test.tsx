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
  it('exposes Phase 1 navigation and shows future spaces as an honest roadmap', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    const overview = screen.getByRole('link', { name: 'Resumen' });
    expect(overview.getAttribute('href')).toBe('/');
    expect(overview.getAttribute('aria-current')).toBe('page');

    // Phase 2 spaces are communicated as a roadmap, not as fake links.
    for (const name of ['Investigaciones', 'Conocimiento', 'Agent Hub', 'Oportunidades', 'Automatizaciones', 'Sistema']) {
      const item = screen.getByText(name);
      expect(item.tagName).toBe('SPAN');
      expect(item.closest('li')?.className).toContain('roadmap-item');
    }
    // There is no dead "Próximamente" command bar.
    expect(screen.queryByRole('search', { name: 'Command center' })).toBeNull();
    expect(screen.queryByLabelText('Comandos')).toBeNull();

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
