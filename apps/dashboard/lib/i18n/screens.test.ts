import { describe, expect, it } from 'vitest';
import { SCREENS_DE, SCREENS_EN, SCREENS_ES, SCREENS_FR, SCREENS_PT } from './screens';
import { translate } from './index';

describe('screen catalog', () => {
  it('es covers every screen key', () => {
    expect(Object.keys(SCREENS_ES).sort()).toEqual(Object.keys(SCREENS_EN).sort());
  });
  it('partial locales only use known keys and keep placeholders', () => {
    for (const cat of [SCREENS_PT, SCREENS_FR, SCREENS_DE]) for (const key of Object.keys(cat)) expect(key in SCREENS_EN).toBe(true);
    for (const [key, value] of Object.entries(SCREENS_ES)) {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(vars(value as string), key).toEqual(vars(SCREENS_EN[key as keyof typeof SCREENS_EN]));
    }
  });
  it('English is the default text and other locales fall back to it', () => {
    expect(translate('en', 's.emptyTitle')).toBe('What are we working on?');
    expect(translate('es', 's.emptyTitle')).toBe('¿En qué trabajamos?');
    expect(translate('de', 's.memoryCopy')).toBe(SCREENS_EN['s.memoryCopy']);
    expect(translate('de', 'f.goalMissionCap')).toBe('GOAL · KERNEL-MISSION');
    expect(translate('en', 's.nFindsPassed', { count: 3 })).toBe('3 Finds passed Kernel SUPPORT');
    expect(translate('es', 's.attempt', { n: 2 })).toBe('intento 2');
  });
});
