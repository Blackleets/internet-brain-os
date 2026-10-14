import { useSyncExternalStore } from 'react';
import { CATALOGS, EN, LOCALES, type Locale, type MessageKey } from './catalog';

export { LOCALES, LOCALE_NAMES, type Locale, type MessageKey } from './catalog';
export const LOCALE_STORAGE_KEY = 'efesto.locale';
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** First supported language from the browser's preference list ("pt-BR" → "pt"); English otherwise. */
export function detectLocale(languages: readonly string[] | undefined): Locale {
  for (const tag of languages ?? []) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

function storage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; }
}

function initialLocale(): Locale {
  const saved = storage()?.getItem(LOCALE_STORAGE_KEY);
  if (isLocale(saved)) return saved;
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}

let current: Locale | undefined;
const listeners = new Set<() => void>();

/**
 * Active locale. Until bootLocale() runs (after hydration) this is English, the same as the server
 * render, so server and client markup always match; then the user's choice/browser language applies.
 */
export function getLocale(): Locale {
  return current ?? DEFAULT_LOCALE;
}

/** Called once on the client after mount: saved choice → browser language → English. */
export function bootLocale(): Locale {
  if (current === undefined) setLocale(initialLocale(), { persist: false });
  return getLocale();
}

/** Explicit user choice: applied now and remembered on this device. */
export function setLocale(locale: Locale, { persist = true }: { persist?: boolean } = {}): void {
  current = locale;
  if (persist) { try { storage()?.setItem(LOCALE_STORAGE_KEY, locale); } catch { /* private mode */ } }
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  for (const listener of listeners) listener();
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = CATALOGS[locale][key] ?? EN[key];
  return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template;
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(getLocale(), key, vars);
}

function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }

/** React binding. The server renders English; the client switches to the user's locale after hydration. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}

export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const locale = useLocale();
  return (key, vars) => translate(locale, key, vars);
}
