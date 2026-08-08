import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workspaceUrl = new URL('../pnpm-workspace.yaml', import.meta.url);
const allowedTemporaryAdvisory = 'GHSA-2v37-7h3g-55p8';

async function workspacePolicy() {
  return readFile(workspaceUrl, 'utf8');
}

function ignoredGhsas(policy) {
  const lines = policy.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*ignoreGhsas:\s*$/.test(line));
  if (start < 0) return [];

  const values = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) || /^\s{0,3}\S/.test(line)) break;
    const match = line.match(/^\s+-\s+(GHSA-[a-z0-9-]+)\s*$/i);
    if (match) values.push(match[1]);
  }
  return values;
}

describe('supply-chain audit policy', () => {
  it('Given the temporary Nano ID advisory exception, When policy is read, Then only that exact GHSA is ignored', async () => {
    const policy = await workspacePolicy();

    expect(ignoredGhsas(policy)).toEqual([allowedTemporaryAdvisory]);
  });

  it('Given production audit is a release gate, When policy is read, Then no global audit downgrade is configured', async () => {
    const policy = await workspacePolicy();

    expect(policy).not.toMatch(/^\s*auditLevel\s*:/m);
    expect(policy).not.toMatch(/^\s*level\s*:\s*(?:critical|high)\s*$/m);
    expect(policy).not.toContain('--ignore-unfixable');
  });

  it('Given the exception is temporary, When policy is reviewed, Then its removal issue is named beside the exception', async () => {
    const policy = await workspacePolicy();

    expect(policy).toContain('Tracked by #145');
    expect(policy).toContain(allowedTemporaryAdvisory);
  });
});
