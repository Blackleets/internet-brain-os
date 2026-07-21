import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateApiToken } from './api-token-store.mjs';

function expectPrivateMode(mode) {
  if (process.platform === 'win32') return;
  expect(mode & 0o777).toBe(0o600);
}

describe('local API token store', () => {
  it('creates and reuses a private persistent token', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-token-')), 'nested', 'kernel-api-token');
    const first = await loadOrCreateApiToken(file);
    const second = await loadOrCreateApiToken(file);
    expect(first).toMatchObject({ source: 'created', filePath: file });
    expect(second).toMatchObject({ token: first.token, source: 'file' });
    expectPrivateMode((await stat(file)).mode);
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

  it('rejects tokens with control characters or whitespace', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-token-')), 'kernel-api-token');
    await expect(loadOrCreateApiToken(file, { envToken: `${'a'.repeat(32)}\n${'b'.repeat(32)}` })).rejects.toThrow('printable');
    await writeFile(file, `${'a'.repeat(32)} ${'b'.repeat(32)}\n`, { mode: 0o600 });
    await expect(loadOrCreateApiToken(file)).rejects.toThrow('printable');
  });

  it('rejects persisted POSIX tokens with group or world permissions', async () => {
    if (process.platform === 'win32') return;
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-token-')), 'kernel-api-token');
    await writeFile(file, `${'a'.repeat(64)}\n`, { mode: 0o600 });
    await chmod(file, 0o644);
    await expect(loadOrCreateApiToken(file)).rejects.toThrow('private file permissions');
  });
});
