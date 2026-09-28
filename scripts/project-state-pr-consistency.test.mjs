import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// PROJECT_STATE.md is the recovery checkpoint agents read first. It said "PR #238 OPEN ...
// before merge" long after #238 was squash-merged (1da97ef), steering agents at a closed PR.
const state = readFileSync(new URL('../PROJECT_STATE.md', import.meta.url), 'utf8');

function prNumbers(pattern) {
  return new Set([...state.matchAll(pattern)].map((match) => match[1]));
}

describe('PROJECT_STATE.md PR status consistency', () => {
  it('never lists a PR as OPEN that it also records as merged', () => {
    const open = prNumbers(/PR #(\d+) OPEN/g);
    const merged = new Set([...prNumbers(/PR #(\d+) merged/g), ...prNumbers(/squash-merge PR #(\d+)/g)]);
    const both = [...open].filter((number) => merged.has(number));
    expect(both).toEqual([]);
  });

  it('records #238 as merged and names the active PR', () => {
    expect(state).toContain('PR #238 merged to `main` as `1da97ef`');
    expect(state).not.toContain('PR #238 OPEN');
    expect(state).toMatch(/PR #241 OPEN/);
  });
});
