import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeObsidian } from './efesto-bootstrap.mjs';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, randomUUID: vi.fn(actual.randomUUID) };
});

const directories = [];
async function vault() {
  const path = await mkdtemp(join(tmpdir(), 'efesto-vault-preserve-'));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('Obsidian diagnostic preserves existing vault entries', () => {
  it('fails closed on an exact probe-name collision without deleting the existing file', async () => {
    const path = await vault();
    const id = '00000000-0000-4000-8000-000000000000';
    const existing = join(path, `.efesto-write-test-${id}`);
    await writeFile(existing, 'DO NOT REPLACE OR DELETE');
    vi.mocked(randomUUID).mockReturnValueOnce(id);
    expect(await probeObsidian({ env: { HEPHAESTUS_OBSIDIAN_DIR: path } })).toMatchObject({ configured: true, writable: false, error: 'EEXIST' });
    expect(await readFile(existing, 'utf8')).toBe('DO NOT REPLACE OR DELETE');
    expect(await readdir(path)).toEqual([`.efesto-write-test-${id}`]);
  });
  it('leaves the legacy fixed-name file and notes intact', async () => {
    const path = await vault();
    await writeFile(join(path, '.efesto-write-test'), 'USER OWNED CONTENT');
    await writeFile(join(path, 'note.md'), 'Evidence and notes');
    expect(await probeObsidian({ env: { HEPHAESTUS_OBSIDIAN_DIR: path } })).toMatchObject({ configured: true, writable: true });
    expect(await readFile(join(path, '.efesto-write-test'), 'utf8')).toBe('USER OWNED CONTENT');
    expect(await readFile(join(path, 'note.md'), 'utf8')).toBe('Evidence and notes');
    expect((await readdir(path)).sort()).toEqual(['.efesto-write-test', 'note.md']);
  });
  it('uses independent probes for simultaneous checks and cleans only those probes', async () => {
    const path = await vault();
    await writeFile(join(path, 'note.md'), 'KEEP');
    const result = await Promise.all(Array.from({ length: 8 }, () => probeObsidian({ env: { HEPHAESTUS_OBSIDIAN_DIR: path } })));
    expect(result.every((item) => item.writable)).toBe(true);
    expect(await readdir(path)).toEqual(['note.md']);
    expect(await readFile(join(path, 'note.md'), 'utf8')).toBe('KEEP');
  });
  it('reports failure without replacing a file configured as a vault directory', async () => {
    const parent = await vault();
    const path = join(parent, 'not-a-directory');
    await writeFile(path, 'KEEP');
    expect(await probeObsidian({ env: { HEPHAESTUS_OBSIDIAN_DIR: path } })).toMatchObject({ configured: true, writable: false });
    expect(await readFile(path, 'utf8')).toBe('KEEP');
  });
});
