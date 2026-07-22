import { describe, expect, it } from 'vitest';
import { AUTO_CAPTURE_COOLDOWN_MS, evaluateAutoCapture, normalizePublicOrigin } from './auto-capture-policy.js';

const context = {
  schemaVersion: 'hephaestus.page-context.v1',
  url: 'https://example.com/opportunities#results',
  title: 'Opportunities',
  visibleText: 'A public grant closes next week.',
};

describe('Efesto automatic capture policy', () => {
  it('captures only explicitly authorized public origins and removes fragments', () => {
    expect(evaluateAutoCapture(context, { allowedOrigins: ['https://example.com'], now: 10_000 }))
      .toEqual({ allowed: true, safeUrl: 'https://example.com/opportunities' });
    expect(evaluateAutoCapture(context, { allowedOrigins: [] })).toMatchObject({ allowed: false, reason: 'site_not_authorized' });
  });

  it.each([
    ['https://example.com/login', 'sensitive_path'],
    ['https://example.com/account/settings', 'sensitive_path'],
    ['https://example.com/find?token=private', 'sensitive_query'],
  ])('blocks sensitive page %s', (url, reason) => {
    expect(evaluateAutoCapture({ ...context, url }, { allowedOrigins: ['https://example.com'] }))
      .toMatchObject({ allowed: false, reason });
  });

  it('blocks selections and repeated captures during the cooldown', () => {
    expect(evaluateAutoCapture({ ...context, selection: 'private copy' }, { allowedOrigins: ['https://example.com'] }))
      .toMatchObject({ allowed: false, reason: 'selection_present' });
    expect(evaluateAutoCapture(context, {
      allowedOrigins: ['https://example.com'], lastCapturedAt: 1_000, now: 1_000 + AUTO_CAPTURE_COOLDOWN_MS - 1,
    })).toMatchObject({ allowed: false, reason: 'cooldown' });
  });

  it('normalizes only HTTP(S) origins', () => {
    expect(normalizePublicOrigin('https://example.com/path')).toBe('https://example.com');
    expect(normalizePublicOrigin('chrome://settings')).toBeUndefined();
    expect(normalizePublicOrigin('not a url')).toBeUndefined();
  });
});
