import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Regression: the composite packages wrote tsconfig.tsbuildinfo next to tsconfig.json (TypeScript's
// default when rootDir=src and outDir=dist), so deleting dist/ left the build info behind. `tsc -b`
// then reported "up to date", `pnpm typecheck` exited 0 with no packages/kernel/dist, and every
// consumer of the built Kernel failed later and far away: the automatic claim gate denied with
// trusted_kernel_unavailable, so `pnpm test` saw "Claim boundary failed with HTTP 204".
// Build info must live inside outDir so removing dist/ always forces a real rebuild.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const references = readJson(resolve(root, 'tsconfig.json')).references.map((ref) => ref.path);

describe('composite package build info', () => {
  it('covers every project referenced by the root build', () => {
    expect(references.length).toBeGreaterThanOrEqual(6);
  });

  it.each(references)('%s keeps tsBuildInfoFile inside its outDir', (reference) => {
    const projectDir = resolve(root, reference);
    const { compilerOptions = {} } = readJson(resolve(projectDir, 'tsconfig.json'));
    expect(compilerOptions.composite, 'composite project').toBe(true);
    expect(compilerOptions.outDir, 'outDir').toBeTruthy();
    expect(compilerOptions.tsBuildInfoFile, 'tsBuildInfoFile must be explicit').toBeTruthy();
    const outDir = resolve(projectDir, compilerOptions.outDir);
    const buildInfo = resolve(projectDir, compilerOptions.tsBuildInfoFile);
    const inside = relative(outDir, buildInfo);
    expect(inside !== '' && !inside.startsWith('..') && !isAbsolute(inside), `${buildInfo} is outside ${outDir}`).toBe(true);
  });
});
