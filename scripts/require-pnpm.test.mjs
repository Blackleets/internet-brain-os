import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { packageManagerVerdict } from './require-pnpm.mjs';

const script = fileURLToPath(new URL('./require-pnpm.mjs', import.meta.url));

// A stray `npm install` at the repo root wrote a flat node_modules (111 packages incl. a second
// copy of next) and a package-lock.json next to the pnpm tree. `npx next build` then loaded two
// Next.js instances and failed with "Invariant: Expected workStore to be initialized".
describe('require-pnpm preinstall guard', () => {
  it('allows pnpm and refuses npm, yarn and bun installs', () => {
    expect(packageManagerVerdict('pnpm/11.11.0 npm/? node/v22.23.3 linux x64').ok).toBe(true);
    for (const agent of ['npm/9.2.0 node/v22.23.3 linux x64 workspaces/true', 'yarn/1.22.22 npm/? node/v22', 'bun/1.2.0 npm/? node/v22']) {
      const verdict = packageManagerVerdict(agent);
      expect(verdict.ok).toBe(false);
      expect(verdict.message).toContain('pnpm install');
    }
  });

  it('does not block when no package manager identifies itself', () => {
    expect(packageManagerVerdict(undefined).ok).toBe(true);
    expect(packageManagerVerdict('').ok).toBe(true);
  });

  it('exits non-zero with guidance under npm and zero under pnpm', () => {
    const npm = spawnSync(process.execPath, [script], { env: { ...process.env, npm_config_user_agent: 'npm/9.2.0 node/v22 linux x64' }, encoding: 'utf8' });
    expect(npm.status).toBe(1);
    expect(npm.stderr).toContain('pnpm install');
    expect(execFileSync(process.execPath, [script], { env: { ...process.env, npm_config_user_agent: 'pnpm/11.11.0 npm/? node/v22' } }).toString()).toBe('');
  });

  it('is wired as the root preinstall script', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.scripts.preinstall).toBe('node scripts/require-pnpm.mjs');
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });

  // npm >= 7 runs the root preinstall only after writing node_modules, so the guard alone reports
  // the mistake too late; engines.npm + engine-strict makes npm refuse before touching the tree.
  it('makes npm refuse before writing node_modules (engines.npm + engine-strict)', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(pkg.engines?.npm).toBe('please-use-pnpm');
    expect(readFileSync(new URL('../.npmrc', import.meta.url), 'utf8')).toMatch(/^engine-strict=true$/m);
  });
});
