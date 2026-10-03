import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import nextConfig, { resolveTurbopackRoot } from './next.config';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

describe('dashboard Next.js config', () => {
  it('uses the workspace root for the local pnpm install', () => {
    expect(nextConfig.turbopack?.root).toBe(workspaceRoot);
    expect(resolveTurbopackRoot()).toBe(workspaceRoot);
  });

  it('uses the workspace root on Vercel too (pnpm store sits outside apps/dashboard)', async () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
      const { vi } = await import('vitest');
      vi.resetModules();
      const fresh = await import('./next.config');
      expect(fresh.default.turbopack?.root).toBe(workspaceRoot);
      expect(fresh.resolveTurbopackRoot()).toBe(workspaceRoot);
    } finally {
      if (previous === undefined) delete process.env.VERCEL; else process.env.VERCEL = previous;
    }
  });

  it('refuses framing on every dashboard route (confirmation clicks must be the owner\'s)', async () => {
    const rules = await nextConfig.headers?.();
    const all = rules?.find((rule) => rule.source === '/:path*');
    const byKey = Object.fromEntries((all?.headers ?? []).map((header) => [header.key.toLowerCase(), header.value]));
    expect(byKey['x-frame-options']).toBe('DENY');
    expect(byKey['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(byKey['referrer-policy']).toBe('no-referrer');
    expect(byKey['x-content-type-options']).toBe('nosniff');
  });
});
