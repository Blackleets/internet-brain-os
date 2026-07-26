import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import nextConfig from './next.config';

describe('dashboard Next.js config', () => {
  it('pins Turbopack to this repository instead of a parent workspace', () => {
    expect(nextConfig.turbopack?.root).toBe(fileURLToPath(new URL('../..', import.meta.url)));
  });
});
