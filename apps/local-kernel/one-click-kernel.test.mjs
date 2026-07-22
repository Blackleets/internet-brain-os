import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('one-click Hermes runtime entrypoints', () => {
  it.each([
    'apps/local-kernel/one-click-kernel.mjs',
    'apps/extension/src/one-click-mission-ui.js',
  ])('parses %s without executing it', (path) => {
    const result = spawnSync(process.execPath, ['--check', resolve(path)], { encoding: 'utf8', windowsHide: true });
    expect(result.status, result.stderr).toBe(0);
  });
});
