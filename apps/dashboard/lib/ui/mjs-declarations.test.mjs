import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Root `pnpm typecheck` (tsc -b) does not cover apps/dashboard; `next build` does, and fails
// TS7016 when a relative .mjs import lacks a sibling .d.mts (a .d.ts is NOT picked up for .mjs).
const dashboard = resolve('apps/dashboard');

function* sources(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sources(path);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) yield path;
  }
}

describe('dashboard relative .mjs imports are typed for next build', () => {
  it('every relative .mjs import from TS has a sibling .d.mts', () => {
    const missing = [];
    for (const file of sources(dashboard)) {
      for (const match of readFileSync(file, 'utf8').matchAll(/from\s+'(\.{1,2}\/[^']+\.mjs)'/g)) {
        const target = resolve(dirname(file), match[1]);
        if (!existsSync(target.replace(/\.mjs$/, '.d.mts'))) missing.push(`${file.slice(dashboard.length + 1)} -> ${match[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
