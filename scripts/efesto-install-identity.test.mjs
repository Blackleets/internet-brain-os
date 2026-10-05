import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectInstallIdentity } from './efesto-install-identity.mjs';

const exec = promisify(execFile);
const dirs = [];
const release = { schema: 'efesto.internal-release.v1', version: '0.1.0-internal.83', channel: 'internal', publicLaunchApproved: false };
async function root() {
  const dir = await mkdtemp(join(tmpdir(), 'efesto-identity-'));
  dirs.push(dir);
  await writeFile(join(dir, 'INTERNAL_RELEASE.json'), JSON.stringify(release));
  return dir;
}
async function git(dir, ...args) { return (await exec('git', args, { cwd: dir })).stdout.trim(); }
async function repository(dir) {
  await git(dir, 'init');
  await git(dir, 'add', '.');
  await git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'identity fixture');
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });

describe('read-only installation identity', () => {
  it('reports checkout identity and detects modifications without printing filenames or reading secrets', async () => {
    const dir = await root();
    await repository(dir);
    const head = await git(dir, 'rev-parse', 'HEAD');
    expect(await inspectInstallIdentity({ root: dir })).toMatchObject({ commit: head, source: 'git_checkout', workingTree: 'clean', runtimeVerified: false });
    await mkdir(join(dir, '.hephaestus'));
    const secret = join(dir, '.hephaestus', 'kernel-api-token');
    await writeFile(secret, 'PRIVATE_TOKEN_DO_NOT_PRINT');
    const result = await inspectInstallIdentity({ root: dir });
    expect(result.workingTree).toBe('modified');
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|kernel-api-token|\.hephaestus/);
    expect(await readFile(secret, 'utf8')).toBe('PRIVATE_TOKEN_DO_NOT_PRINT');
  });
  it('retains the exact Git archive commit after extraction', async () => {
    const dir = await root();
    await writeFile(join(dir, '.gitattributes'), 'BUILD_COMMIT.txt export-subst\n');
    await writeFile(join(dir, 'BUILD_COMMIT.txt'), '$Format:%H$\n');
    await repository(dir);
    const head = await git(dir, 'rev-parse', 'HEAD');
    const { stdout } = await exec('git', ['archive', 'HEAD', 'BUILD_COMMIT.txt'], { cwd: dir, encoding: 'buffer' });
    const extracted = await root();
    // Skip Git's global PAX metadata and read the named tar entry portably.
    let content;
    for (let offset = 0; offset + 512 <= stdout.length;) {
      const name = stdout.subarray(offset, offset + 100).toString().split('\0')[0];
      const size = parseInt(stdout.subarray(offset + 124, offset + 136).toString().replace(/\0/g, '').trim(), 8) || 0;
      if (name === 'BUILD_COMMIT.txt') { content = stdout.subarray(offset + 512, offset + 512 + size); break; }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    expect(content).toBeDefined();
    await writeFile(join(extracted, 'BUILD_COMMIT.txt'), content);
    expect(await inspectInstallIdentity({ root: extracted })).toMatchObject({ commit: head, source: 'git_archive', workingTree: 'unavailable', authenticityVerified: false });
  });
  it('never attributes a nested extracted package to its parent checkout', async () => {
    const parent = await root();
    await repository(parent);
    const nested = join(parent, 'package');
    await mkdir(nested);
    await writeFile(join(nested, 'INTERNAL_RELEASE.json'), JSON.stringify(release));
    expect(await inspectInstallIdentity({ root: nested })).toMatchObject({ source: 'unknown', commit: null });
  });
  it('keeps unexpanded, malformed or missing archive identities unknown', async () => {
    const dir = await root();
    for (const value of ['$Format:%H$', 'not-a-commit', 'a'.repeat(40) + '\nSECRET']) {
      await writeFile(join(dir, 'BUILD_COMMIT.txt'), value);
      expect(await inspectInstallIdentity({ root: dir })).toMatchObject({ source: 'unknown', commit: null });
    }
  });
  it('rejects invalid or public release metadata without exposing arbitrary values', async () => {
    const dir = await root();
    await writeFile(join(dir, 'INTERNAL_RELEASE.json'), JSON.stringify({ ...release, version: 'SECRET', publicLaunchApproved: true }));
    expect(await inspectInstallIdentity({ root: dir })).toMatchObject({ version: null, releaseMetadata: 'invalid' });
    await writeFile(join(dir, 'INTERNAL_RELEASE.json'), 'invalid SECRET JSON');
    expect(JSON.stringify(await inspectInstallIdentity({ root: dir }))).not.toContain('SECRET');
  });
});
