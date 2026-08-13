import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workspaceUrl = new URL('../pnpm-workspace.yaml', import.meta.url);
const lockfileUrl = new URL('../pnpm-lock.yaml', import.meta.url);

async function read(url) {
  return readFile(url, 'utf8');
}

describe('supply-chain audit policy', () => {
  it('requires the patched Nano ID line and keeps production audit unfiltered', async () => {
    const policy = await read(workspaceUrl);

    expect(policy).toContain("nanoid: '3.3.18'");
    expect(policy).not.toContain('ignoreGhsas');
    expect(policy).not.toContain('GHSA-2v37-7h3g-55p8');
    expect(policy).not.toMatch(/^\s*auditLevel\s*:/m);
    expect(policy).not.toContain('--ignore-unfixable');
  });

  it('locks the patched Nano ID package and removes the vulnerable 3.3.16 package', async () => {
    const lockfile = await read(lockfileUrl);

    expect(lockfile).toContain('nanoid@3.3.18:');
    expect(lockfile).toContain('nanoid: 3.3.18');
    expect(lockfile).not.toContain('nanoid@3.3.16:');
  });
});
