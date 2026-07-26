// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('exposes navigation, command entry, and main content landmarks', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Resumen' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Investigaciones' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    expect(screen.getByLabelText('Comandos')).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });
});
