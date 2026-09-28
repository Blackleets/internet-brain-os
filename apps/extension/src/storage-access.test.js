import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { restrictLocalStorageToTrustedContexts } from './storage-access.js';

describe('restrictLocalStorageToTrustedContexts (Kernel token off content scripts)', () => {
  it('restricts storage.local to trusted contexts when supported', async () => {
    const setAccessLevel = vi.fn(async () => undefined);
    await expect(restrictLocalStorageToTrustedContexts({ local: { setAccessLevel } })).resolves.toBe('restricted');
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });

  it('is a no-op on Chrome builds without local setAccessLevel', async () => {
    await expect(restrictLocalStorageToTrustedContexts({ local: {} })).resolves.toBe('unsupported');
    await expect(restrictLocalStorageToTrustedContexts(undefined)).resolves.toBe('unsupported');
  });

  it('never throws when an older Chrome rejects the call for storage.local', async () => {
    const setAccessLevel = vi.fn(async () => { throw new Error('This storage area does not support setAccessLevel'); });
    await expect(restrictLocalStorageToTrustedContexts({ local: { setAccessLevel } })).resolves.toBe('unsupported');
  });

  it('content scripts never read chrome.storage, so the restriction cannot break them', () => {
    const manifest = JSON.parse(readFileSync(resolve('apps/extension/manifest.json'), 'utf8'));
    const scripts = manifest.content_scripts.flatMap((entry) => entry.js);
    expect(scripts.length).toBeGreaterThan(0);
    for (const script of scripts) {
      const source = readFileSync(resolve('apps/extension', script), 'utf8');
      expect(source, script).not.toMatch(/chrome\.storage|browser\.storage/);
      expect(source, script).not.toMatch(/^\s*import\s/m);
    }
  });

  it('background applies it at service-worker startup', () => {
    const background = readFileSync(resolve('apps/extension/src/background.js'), 'utf8');
    expect(background).toContain("import { restrictLocalStorageToTrustedContexts } from './storage-access.js';");
    expect(background).toContain('void restrictLocalStorageToTrustedContexts(chrome.storage);');
  });
});
