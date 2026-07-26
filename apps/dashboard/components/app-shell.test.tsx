// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('exposes navigation, command entry, and main content landmarks', () => {
    render(<AppShell><h1>Overview</h1></AppShell>);
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    expect(screen.getByRole('search', { name: 'Command center' })).toBeTruthy();
    expect(screen.getByRole('main').textContent).toContain('Overview');
  });
});
