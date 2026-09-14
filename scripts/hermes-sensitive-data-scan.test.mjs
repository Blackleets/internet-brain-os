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

  it('blocks JS/Python object-literal Kernel credential dumps that previously bypassed JSON-only preflight', () => {
    const kernelToken = 'kernel-token-value-that-must-not-ingest';
    // Real console / DevTools shapes: SESSION_CONNECTION / KernelConnection / chrome.storage
    // often serialize with unquoted or single-quoted keys — dee4431 only closed double-quoted JSON.
    const input = [
      `{baseUrl: 'http://127.0.0.1:4000', token: '${kernelToken}'}`,
      `{'baseUrl': 'http://127.0.0.1:4000', 'token': '${kernelToken}'}`,
      `{kernelBaseUrl: 'http://127.0.0.1:4000', kernelApiToken: '${kernelToken}'}`,
      `apiToken: "${kernelToken}"`,
    ].join('\n');

    const findings = scanHermesSensitiveData(input);

    expect(findings).toEqual([
      { code: 'SENSITIVE_JSON_FIELD', line: 1 },
      { code: 'SENSITIVE_JSON_FIELD', line: 2 },
      { code: 'SENSITIVE_JSON_FIELD', line: 3 },
      { code: 'SENSITIVE_JSON_FIELD', line: 4 },
    ]);
    expect(JSON.stringify(findings)).not.toContain(kernelToken);
  });

  it('blocks Chrome HAR name/value Kernel credential dumps that previously bypassed key:value preflight', () => {
    const kernelToken = 'kernel-token-value-that-must-not-ingest';
    // Real mounted DevTools dump: Network → Save all as HAR / Copy as HAR stores Kernel
    // auth as adjacent name/value objects, not "token":"..." or x-hephaestus-token: value.
    const prettyHar = JSON.stringify({
      log: {
        version: '1.2',
        entries: [{
          request: {
            method: 'GET',
            url: 'http://127.0.0.1:4000/api/opportunities',
            headers: [
              { name: 'Accept', value: 'application/json' },
              { name: 'x-hephaestus-token', value: kernelToken },
              { name: 'Authorization', value: `Bearer ${kernelToken}` },
            ],
            queryString: [{ name: 'token', value: kernelToken }],
          },
        }],
      },
    }, null, 2);
    const compact = [
      JSON.stringify({ name: 'kernelApiToken', value: kernelToken }),
      JSON.stringify({ name: 'apiToken', value: kernelToken }),
      JSON.stringify({ name: 'Cookie', value: `session=${kernelToken}` }),
    ].join('\n');

    const findings = scanHermesSensitiveData(`${prettyHar}\n${compact}`);

    expect(findings.length).toBeGreaterThanOrEqual(5);
    expect(findings.every((item) => item.code === 'SENSITIVE_HAR_NAME_VALUE')).toBe(true);
    expect(JSON.stringify(findings)).not.toContain(kernelToken);
    // Proven bypass before this gate: the same HAR returned [].
    expect(scanHermesSensitiveData(JSON.stringify({ name: 'x-hephaestus-token', value: kernelToken }))).toEqual([
      { code: 'SENSITIVE_HAR_NAME_VALUE', line: 1 },
    ]);
  });

  it('blocks Node undici/fetch header-tuple Kernel credential dumps that previously bypassed HAR/JSON preflight', () => {
    const kernelToken = 'kernel-token-value-that-must-not-ingest';
    // Real mounted Node shapes: undici/fetch RequestInit.headers as array-of-pairs,
    // Headers.entries() JSON dumps, and pretty-printed mission-worker request options.
    // 213b340 closed HAR {name,value}; key:value JSON still misses ["x-hephaestus-token","..."].
    const input = [
      JSON.stringify({ headers: [['x-hephaestus-token', kernelToken], ['accept', 'application/json']] }),
      JSON.stringify({ headers: [['Authorization', `Bearer ${kernelToken}`]] }),
      JSON.stringify({ headers: [['apiToken', kernelToken]] }),
      JSON.stringify([['kernelApiToken', kernelToken]]),
      JSON.stringify({ method: 'GET', headers: [['accept', 'application/json'], ['x-hephaestus-token', kernelToken]] }, null, 2),
      `headers: [ [ 'x-hephaestus-token', '${kernelToken}' ] ]`,
    ].join('\n');

    const findings = scanHermesSensitiveData(input);

    expect(findings.length).toBeGreaterThanOrEqual(6);
    expect(findings.every((item) => item.code === 'SENSITIVE_HEADER_TUPLE')).toBe(true);
    expect(JSON.stringify(findings)).not.toContain(kernelToken);
    // Proven bypass before this gate: the same undici header array returned [].
    expect(scanHermesSensitiveData(JSON.stringify({ headers: [['x-hephaestus-token', kernelToken]] }))).toEqual([
      { code: 'SENSITIVE_HEADER_TUPLE', line: 1 },
    ]);
  });
});
