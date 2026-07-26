// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

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
    expect(screen.getByTestId('mobile-readiness').className).toContain('mobile-readiness');
    expect(screen.getByTestId('mobile-readiness').textContent).toContain('Kernel sin conexión');
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });
});
