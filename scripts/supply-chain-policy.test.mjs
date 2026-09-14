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

  it('requires patched Next.js and sharp floors that clear production audit criticals', async () => {
    const policy = await read(workspaceUrl);
    const dashboardPkg = await read(new URL('../apps/dashboard/package.json', import.meta.url));
    const lockfile = await read(lockfileUrl);
    // GHSA-p293-qw3h-jr36 / GHSA-2xp9-vwfh-vxw4: next >=16.0.0 <16.3.3 is RCE-critical.
    // Floor is 16.3.3 — not bare 16.3.x (16.3.0–16.3.2 remain vulnerable).
    expect(dashboardPkg).toMatch(/"next"\s*:\s*"16\.(?:3\.(?:[3-9]|\d{2,})|[4-9]\.\d+|\d{2,}\.\d+)/);
    expect(dashboardPkg).not.toMatch(/"next"\s*:\s*"16\.2\./);
    expect(dashboardPkg).not.toMatch(/"next"\s*:\s*"16\.3\.[012]"/);
    // Lockfile must not reintroduce the vulnerable 16.3.0–16.3.2 package graph.
    expect(lockfile).toMatch(/^ {2}next@16\.(?:3\.(?:[3-9]|\d{2,})|[4-9]\.\d+|\d{2,}\.\d+):/m);
    expect(lockfile).not.toMatch(/^ {2}next@16\.3\.[012]:/m);
    expect(lockfile).not.toMatch(/^ {2}next@16\.2\./m);
    // GHSA-rgj7-g3m4-5g8c: sharp <0.35.4 via next>sharp
    expect(policy).toContain("sharp: '>=0.35.4'");
    expect(policy).not.toContain("sharp: '>=0.35.0'");
  });
});
