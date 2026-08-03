import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('delivery gates', () => {
  it('keeps the real dashboard browser flow in CI', async () => {
    const [manifest, workflow] = await Promise.all([
      readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
      readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
    ]);

    expect(manifest.scripts['dashboard:e2e']).toBe(
      'pnpm --filter @internet-brain-os/dashboard e2e',
    );
    expect(workflow).toContain('dashboard-e2e:');
    expect(workflow).toContain(
      'pnpm --filter @internet-brain-os/dashboard exec playwright install --with-deps chromium',
    );
    expect(workflow).toContain('run: pnpm dashboard:e2e');
  });
});
