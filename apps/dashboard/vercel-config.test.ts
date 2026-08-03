import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const configPath = fileURLToPath(new URL('./vercel.json', import.meta.url));

describe('dashboard Vercel config', () => {
  it('pins Next.js without pretending to own project-level root settings', () => {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;

    expect(config.framework).toBe('nextjs');
    expect(config).not.toHaveProperty('rootDirectory');
  });
});
