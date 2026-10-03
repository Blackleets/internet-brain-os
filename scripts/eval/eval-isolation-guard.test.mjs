// Guard: the offline Jev bench must never become part of the product.
import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const PRODUCT_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', 'build', 'out', 'dist-sqlite-test', 'test-results', 'playwright-report']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.html']);
const IMPORT_SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      yield* walk(join(dir, entry.name));
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      yield join(dir, entry.name);
    }
  }
}

async function productFiles() {
  const files = [];
  for (const root of PRODUCT_ROOTS) for await (const file of walk(join(repoRoot, root))) files.push(file);
  return files;
}

describe('eval harness isolation', () => {
  it('no product file (apps/**, packages/**) imports scripts/eval or the Jev bench', async () => {
    const offenders = [];
    for (const file of await productFiles()) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(IMPORT_SPECIFIER)) {
        const specifier = match[1].replaceAll('\\', '/');
        if (specifier.includes('scripts/eval') || specifier.includes('jev-ranking-bench') || /(^|\/)eval\/jev/.test(specifier)) {
          offenders.push(`${relative(repoRoot, file)} -> ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no product file references Jev endpoints or credentials', async () => {
    const offenders = [];
    const forbidden = [/JEV_API_KEY/, /JEV_BASE_URL/, /jevtypesafeai\.com/i, /api\.typesafe\.ai/i, /typesafe-ai\/jev/i, /\/v1\/systemone/, /\bjv_live_/];
    for (const file of await productFiles()) {
      const source = await readFile(file, 'utf8');
      for (const pattern of forbidden) if (pattern.test(source)) offenders.push(`${relative(repoRoot, file)} ~ ${pattern}`);
    }
    expect(offenders).toEqual([]);
  });

  it('the Kernel SUPPORT gate stays Jev-free and import-free', async () => {
    const support = await readFile(join(repoRoot, 'packages/kernel/src/evidence/support.ts'), 'utf8');
    expect(support).not.toMatch(/jev|typesafe|fetch\s*\(/i);
    expect(support).not.toMatch(/^\s*import\s/m);
  });

  it('no workspace package.json depends on the eval harness', async () => {
    const offenders = [];
    for (const file of await productFiles()) {
      if (!file.endsWith('package.json')) continue;
      const pkg = await readFile(file, 'utf8');
      if (/scripts\/eval|jev/i.test(pkg)) offenders.push(relative(repoRoot, file));
    }
    expect(offenders).toEqual([]);
    const rootPkg = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));
    expect(rootPkg.scripts['eval:jev']).toBe('node scripts/eval/jev-ranking-bench.mjs');
  });
});
