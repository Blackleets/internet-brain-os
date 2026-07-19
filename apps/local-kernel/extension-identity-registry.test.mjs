import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ExtensionIdentityRegistry } from './extension-identity-registry.mjs';

const first = `chrome-extension://${'a'.repeat(32)}`;
const second = `chrome-extension://${'b'.repeat(32)}`;

describe('ExtensionIdentityRegistry', () => {
  it('allows migration while empty, then persists an exact allowlist privately', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-identities-')), 'nested', 'extensions.json');
    const registry = new ExtensionIdentityRegistry(file);
    expect(await registry.allows(first)).toBe(true);
    expect(await registry.authorize(first)).toEqual({ id: 'a'.repeat(32), added: true });
    expect(await registry.allows(first)).toBe(true);
    expect(await registry.allows(second)).toBe(false);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(file, 'utf8')).extensionIds).toEqual(['a'.repeat(32)]);
    expect(await new ExtensionIdentityRegistry(file).allows(first)).toBe(true);
    await registry.clear();
    expect(await registry.allows(second)).toBe(true);
    expect(JSON.parse(await readFile(file, 'utf8')).extensionIds).toEqual([]);
  });

  it('rejects malformed origins without changing the registry', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'hephaestus-identities-')), 'extensions.json');
    const registry = new ExtensionIdentityRegistry(file);
    await expect(registry.authorize('https://example.com')).rejects.toThrow('valid Chrome extension origin');
  });
});
