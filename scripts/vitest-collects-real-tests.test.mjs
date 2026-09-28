import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// `pnpm test` is vitest. A *.test.* file written against node:test is collected as
// "0 tests, passed" and never executes (no CI step runs `node --test` on it), so its
// assertions were silently dead: kernel-events, mcp-server and state-pill-label were.
describe('vitest-collected test files', () => {
  it('never import node:test (they would pass with zero tests)', () => {
    const files = execFileSync('git', ['ls-files', '*.test.js', '*.test.mjs', '*.test.ts', '*.test.tsx'], { cwd: repoRoot, encoding: 'utf8' })
      .split('\n').filter(Boolean);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((file) => /from\s+['"]node:test['"]|require\(\s*['"]node:test['"]\s*\)/.test(readFileSync(new URL(file, `file://${repoRoot}`), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
