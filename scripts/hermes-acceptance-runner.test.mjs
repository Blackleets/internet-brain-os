import { describe, expect, it } from 'vitest';
import { HOSTILE_URLS } from './hermes-acceptance-checks.mjs';
import { ACCEPTANCE_ORIGIN, assertLoopback, redact } from './hermes-acceptance-lib.mjs';

describe('hermes acceptance runner helpers', () => {
  it('rejects any non-loopback Kernel target', () => {
    expect(() => assertLoopback('http://example.com')).toThrow();
    expect(() => assertLoopback('http://10.0.0.4:4000')).toThrow();
    expect(() => assertLoopback('https://127.0.0.1:4000')).toThrow();
    expect(assertLoopback('http://127.0.0.1:4000/')).toBe('http://127.0.0.1:4000');
  });

  it('redacts tokens, absolute paths and control characters', () => {
    const token = 'a'.repeat(64);
    const openRouterKey = 'sk-or-v1-notarealprovidercredential123456789';
    expect(redact(`token=${token}`)).not.toContain(token);
    expect(redact(`OPENROUTER_API_KEY=${openRouterKey}`)).not.toContain(openRouterKey);
    expect(redact(`Authorization: Bearer ${openRouterKey}`)).not.toContain(openRouterKey);
    expect(redact('C:\\Users\\someone\\secret')).not.toContain('someone');
    expect(redact('/home/someone/secret')).not.toContain('someone');
    expect(redact('line\u0000break')).not.toContain('\u0000');
  });

  it('bounds redacted output', () => {
    expect(redact('x'.repeat(5_000)).length).toBeLessThanOrEqual(500);
  });

  it('covers every hostile URL class the Kernel must reject', () => {
    const joined = HOSTILE_URLS.join(' ');
    for (const marker of ['127.0.0.1', 'localhost', '10.0.0.5', '192.168.', '172.16.', '169.254.', '[::1]', 'fd00::', 'fe80::', 'user:secret@', 'file://', 'access_token=']) {
      expect(joined).toContain(marker);
    }
  });

  it('uses an explicit trusted loopback origin for interactive acceptance', () => {
    expect(ACCEPTANCE_ORIGIN).toBe('http://127.0.0.1:4173');
  });
});
