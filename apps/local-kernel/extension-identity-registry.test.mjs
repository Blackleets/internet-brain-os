import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';

function expectPrivateMode(mode) {
  if (process.platform === 'win32') return;
  expect(mode & 0o777).toBe(0o600);
}

const first = `chrome-extension://${'a'.repeat(32)}`;
const second = `chrome-extension://${'b'.repeat(32)}`;

describe('ExtensionIdentityRegistry', () => {
  it('denies extension origins while empty by default, then persists an exact allowlist privately', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-identities-')), 'nested', 'extensions.json');
    const registry = new ExtensionIdentityRegistry(file);
    expect(await registry.allows(first)).toBe(false);
    expect(await registry.authorize(first)).toEqual({ id: 'a'.repeat(32), added: true });
    expect(await registry.allows(first)).toBe(true);
    expect(await registry.allows(second)).toBe(false);
    expectPrivateMode((await stat(file)).mode);
    expect(JSON.parse(await readFile(file, 'utf8')).extensionIds).toEqual(['a'.repeat(32)]);
    expect(await new ExtensionIdentityRegistry(file).allows(first)).toBe(true);
    await registry.clear();
    expect(await registry.allows(second)).toBe(false);
    expect(JSON.parse(await readFile(file, 'utf8')).extensionIds).toEqual([]);
  });

  it('rejects malformed origins without changing the registry', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-identities-')), 'extensions.json');
    const registry = new ExtensionIdentityRegistry(file);
    await expect(registry.authorize('https://example.com')).rejects.toThrow('valid Chrome extension origin');
  });

  it('rejects corrupt, duplicate, and insecure persisted registries', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-identities-')), 'extensions.json');
    await writeFile(file, `${JSON.stringify({ version: 1, extensionIds: ['a'.repeat(32), 'a'.repeat(32)] })}\n`, { mode: 0o600 });
    await expect(new ExtensionIdentityRegistry(file).ready).rejects.toThrow('Invalid extension identity registry');

    await writeFile(file, '{not-json', { mode: 0o600 });
    await expect(new ExtensionIdentityRegistry(file).ready).rejects.toThrow();

    if (process.platform !== 'win32') {
      await writeFile(file, `${JSON.stringify({ version: 1, extensionIds: ['a'.repeat(32)] })}\n`, { mode: 0o600 });
      await chmod(file, 0o644);
      await expect(new ExtensionIdentityRegistry(file).ready).rejects.toThrow('private file permissions');
    }
  });
});
