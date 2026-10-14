import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detectPopupLocale, POPUP_CATALOGS, popupT } from './popup-i18n.js';
import { displayHost, goalPayload, hasToken, isAnalyzablePage, kernelBaseFrom } from './popup-v2-logic.js';

const html = readFileSync(fileURLToPath(new URL('./popup-v2.html', import.meta.url)), 'utf8');

describe('popup v2 i18n', () => {
  it('defaults to English and detects supported languages', () => {
    expect(detectPopupLocale(['ja-JP'])).toBe('en');
    expect(detectPopupLocale(['es-MX', 'en'])).toBe('es');
    expect(popupT('de', 'firstFailed')).toBe(POPUP_CATALOGS.en.firstFailed);
  });
  it('es is complete and every key used in the HTML exists in English', () => {
    expect(Object.keys(POPUP_CATALOGS.es).sort()).toEqual(Object.keys(POPUP_CATALOGS.en).sort());
    for (const [, key] of html.matchAll(/data-i18n(?:-placeholder|-aria)?="(\w+)"/g)) expect(POPUP_CATALOGS.en[key], key).toBeTruthy();
    for (const locale of Object.keys(POPUP_CATALOGS)) for (const key of Object.keys(POPUP_CATALOGS[locale])) expect(key in POPUP_CATALOGS.en, `${locale}:${key}`).toBe(true);
  });
});

describe('popup v2 behaviour helpers', () => {
  it('token and Kernel defaults', () => {
    expect(hasToken({ kernelApiToken: 'x'.repeat(32) })).toBe(true);
    expect(hasToken({ kernelApiToken: 'short' })).toBe(false);
    expect(kernelBaseFrom({})).toBe('http://127.0.0.1:4310');
  });
  it('only public http(s) pages are analyzable', () => {
    expect(isAnalyzablePage('https://example.com/a')).toBe(true);
    expect(isAnalyzablePage('chrome://extensions')).toBe(false);
    expect(displayHost('https://www.typescriptlang.org/docs/handbook')).toBe('typescriptlang.org/docs/handbook');
  });
  it('builds a Goal without launching anything', () => {
    expect(goalPayload('  Free TypeScript guides for beginners ')).toEqual({ title: 'Free TypeScript guides for beginners', keywords: ['free', 'typescript', 'guides', 'beginners'], priority: 2 });
    expect(goalPayload('a')).toBeUndefined();
  });
  it('manual pairing lives behind Advanced and the dashboard link is local', () => {
    expect(html).toMatch(/<details class="adv" id="advanced">[\s\S]*id="pairing-code"/);
    expect(html).toContain('href="http://127.0.0.1:3311/"');
    expect(html).not.toMatch(/<script(?![^>]*src=)/);
  });
});
