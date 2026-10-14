// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LanguageCard } from './efesto-product-views';
import { LOCALE_STORAGE_KEY, setLocale } from '../lib/i18n';

afterEach(() => { cleanup(); setLocale('es', { persist: false }); window.localStorage.clear(); });

describe('Settings language switcher', () => {
  it('lists every language, marks the active one and persists a choice', () => {
    setLocale('en', { persist: false });
    render(<LanguageCard />);
    const group = screen.getByRole('radiogroup', { name: 'Language' });
    expect(group.querySelectorAll('[role=radio]')).toHaveLength(5);
    expect(screen.getByRole('radio', { name: 'English' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Deutsch' }));
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('de');
    expect(screen.getByRole('radiogroup', { name: 'Sprache' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Deutsch' }).getAttribute('aria-checked')).toBe('true');
  });
});
