// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { CATALOGS, EN, LOCALES } from './catalog';
import { bootLocale, detectLocale, getLocale, LOCALE_STORAGE_KEY, setLocale, t, translate } from './index';

afterEach(() => { setLocale('es', { persist: false }); window.localStorage.clear(); });

describe('Efesto i18n', () => {
  it('detects the browser language and falls back to English', () => {
    expect(detectLocale(['pt-BR', 'en'])).toBe('pt');
    expect(detectLocale(['ja-JP', 'de-AT'])).toBe('de');
    expect(detectLocale(['ja-JP'])).toBe('en');
    expect(detectLocale(undefined)).toBe('en');
  });

  it('English is the default source; other catalogs fall back key by key', () => {
    expect(translate('en', 'nav.settings')).toBe('Settings');
    expect(translate('es', 'nav.settings')).toBe('Ajustes');
    expect(translate('de', 'settings.autoHelp')).toBe(EN['settings.autoHelp']);
    expect(translate('fr', 'chip.port', { port: 4320 })).toBe('port 4320');
  });

  it('boot picks the saved choice once (post-hydration)', () => {
    // setup already pinned es; boot must not override an active locale
    expect(bootLocale()).toBe('es');
  });

  it('persists an explicit choice and updates <html lang>', () => {
    setLocale('fr');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    expect(getLocale()).toBe('fr');
    expect(t('nav.home')).toBe('Accueil');
  });

  it('every catalog only uses known keys and keeps {placeholders}', () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(CATALOGS[locale])) {
        expect(key in EN, `${locale}:${key}`).toBe(true);
        const want = (EN[key as keyof typeof EN].match(/\{\w+\}/g) ?? []).sort().join();
        expect((value!.match(/\{\w+\}/g) ?? []).sort().join(), `${locale}:${key}`).toBe(want);
      }
    }
    expect(Object.keys(CATALOGS.es).sort()).toEqual(Object.keys(EN).sort());
  });
});
