import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import nextConfig, { resolveTurbopackRoot } from './next.config';

describe('dashboard Next.js config', () => {
  it('uses the workspace root for the local pnpm install', () => {
    expect(nextConfig.turbopack?.root).toBe(fileURLToPath(new URL('../..', import.meta.url)));
    expect(resolveTurbopackRoot(false)).toBe(fileURLToPath(new URL('../..', import.meta.url)));
  });

  it('uses the self-contained app root in Vercel', () => {
    expect(resolveTurbopackRoot(true)).toBe(fileURLToPath(new URL('.', import.meta.url)));
  });
});
