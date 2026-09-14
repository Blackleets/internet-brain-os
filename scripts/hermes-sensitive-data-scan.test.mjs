import { describe, expect, it } from 'vitest';
import { scanHermesSensitiveData } from './hermes-sensitive-data-scan-core.mjs';

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

  it('blocks dashboard session connection token JSON that previously bypassed preflight', () => {
    const kernelToken = 'kernel-token-value-that-must-not-ingest';
    // Real mounted dashboard shape: SESSION_CONNECTION_KEY / KernelConnection stores { baseUrl, token }.
    // 50da372 covered apiToken/kernelApiToken but not bare "token", so session dumps could ingest.
    const input = [
      JSON.stringify({ baseUrl: 'http://127.0.0.1:4000', token: kernelToken }),
      `{"token":"${kernelToken}"}`,
    ].join('\n');

    const findings = scanHermesSensitiveData(input);

    expect(findings).toEqual([
      { code: 'SENSITIVE_JSON_FIELD', line: 1 },
      { code: 'SENSITIVE_JSON_FIELD', line: 2 },
    ]);
    expect(JSON.stringify(findings)).not.toContain(kernelToken);
  });

  it('blocks Kernel auth header and apiToken JSON fields that previously bypassed preflight', () => {
    const kernelToken = 'kernel-token-value-that-must-not-ingest';
    const input = [
      `x-hephaestus-token: ${kernelToken}`,
      `X-Hephaestus-Token: ${kernelToken}`,
      `{"apiToken":"${kernelToken}"}`,
      `{"kernelApiToken":"${kernelToken}"}`,
      `{"x-hephaestus-token":"${kernelToken}"}`,
      `{"HEPHAESTUS_API_TOKEN":"${kernelToken}"}`,
    ].join('\n');

    const findings = scanHermesSensitiveData(input);

    // Header form → HEPHAESTUS_TOKEN_HEADER; JSON credential fields → SENSITIVE_JSON_FIELD.
    // Previously all six lines returned [] and could pass Hermes ingest/import preflight.
    expect(findings).toEqual([
      { code: 'HEPHAESTUS_TOKEN_HEADER', line: 1 },
      { code: 'HEPHAESTUS_TOKEN_HEADER', line: 2 },
      { code: 'SENSITIVE_JSON_FIELD', line: 3 },
      { code: 'SENSITIVE_JSON_FIELD', line: 4 },
      { code: 'SENSITIVE_JSON_FIELD', line: 5 },
      { code: 'SENSITIVE_JSON_FIELD', line: 6 },
    ]);
    expect(JSON.stringify(findings)).not.toContain(kernelToken);
  });
});
