import { describe, expect, it } from 'vitest';
import { scanHermesSensitiveData } from './hermes-sensitive-data-scan.mjs';

describe('Hermes sensitive-data preflight', () => {
  it('accepts a sanitized bounded execution without changing it', () => {
    const input = JSON.stringify({
      runId: 'run-1',
      summary: 'Public evidence gathered',
      evidence: [{ id: 'evidence-1', source: 'https://example.com/public' }],
    });

    expect(scanHermesSensitiveData(input)).toEqual([]);
  });

  it('reports sensitive classes and line numbers without returning their values', () => {
    const secret = 'sk-sensitive-value-that-must-not-leak';
    const input = [
      '{"runId":"run-1"}',
      `{"api_key":"${secret}"}`,
      `authorization: Bearer ${secret}`,
      'https://user:password@example.com/private',
      '-----BEGIN PRIVATE KEY-----',
    ].join('\n');

    const findings = scanHermesSensitiveData(input);

    expect(findings).toEqual(expect.arrayContaining([
      { code: 'SENSITIVE_JSON_FIELD', line: 2 },
      { code: 'AUTH_BEARER', line: 3 },
      { code: 'URL_CREDENTIALS', line: 4 },
      { code: 'PRIVATE_KEY', line: 5 },
    ]));
    expect(JSON.stringify(findings)).not.toContain(secret);
  });

  it('detects local ingestion secrets and cookies in console captures', () => {
    const findings = scanHermesSensitiveData([
      'IBOS_HERMES_SECRET=do-not-share-this-value',
      'set-cookie: session=private-session-value',
    ].join('\n'));

    expect(findings).toEqual([
      { code: 'SENSITIVE_ENV_VALUE', line: 1 },
      { code: 'COOKIE_HEADER', line: 2 },
    ]);
  });
});
