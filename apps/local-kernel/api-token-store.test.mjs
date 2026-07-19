import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateApiToken } from './api-token-store.mjs';

describe('local API token store', () => {
  it('creates and reuses a private persistent token', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-token-')), 'nested', 'kernel-api-token');
    const first = await loadOrCreateApiToken(file);
    const second = await loadOrCreateApiToken(file);
    expect(first).toMatchObject({ source: 'created', filePath: file });
    expect(second).toMatchObject({ token: first.token, source: 'file' });
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await readFile(file, 'utf8')).trim()).toBe(first.token);
  });

  it('rotates only when explicitly requested and validates environment overrides', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-token-')), 'kernel-api-token');
    const first = await loadOrCreateApiToken(file);
    const rotated = await loadOrCreateApiToken(file, { rotate: true });
    expect(rotated.token).not.toBe(first.token);
    expect(rotated.source).toBe('rotated');
    await expect(loadOrCreateApiToken(file, { envToken: 'short' })).rejects.toThrow('32-512');
  });
});
