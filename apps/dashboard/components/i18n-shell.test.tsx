// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import EfestoProductShell from './efesto-product-shell';
import { setLocale } from '../lib/i18n';

afterEach(() => { cleanup(); setLocale('es', { persist: false }); });

describe('shell follows the active language', () => {
  it('renders English by default and switches live', () => {
    setLocale('en', { persist: false });
    render(<EfestoProductShell />);
    const nav = screen.getByRole('navigation', { name: 'Efesto areas' });
    expect(nav.textContent).toContain('Workspace');
    expect(nav.textContent).toContain('Finds');
    expect(screen.getAllByPlaceholderText('Describe your Goal…').length).toBeGreaterThan(0);
    act(() => setLocale('es', { persist: false }));
    expect(screen.getByRole('navigation', { name: 'Áreas de Efesto' }).textContent).toContain('Hallazgos');
  });
});
