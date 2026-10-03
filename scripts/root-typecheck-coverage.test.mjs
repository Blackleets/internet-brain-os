import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// CI "Typecheck" runs root `pnpm typecheck`. tsc -b only follows root tsconfig references
// (packages/*), so apps/dashboard type errors (e.g. TS7016 on state-pill-label.mjs) only
// surfaced later in `next build`. Root typecheck must also typecheck the dashboard.
describe('root typecheck coverage', () => {
  it('typechecks packages (tsc -b) and apps/dashboard (tsc --noEmit)', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
    const script = pkg.scripts.typecheck;
    expect(script).toContain('tsc -b');
    expect(script).toContain('--filter @internet-brain-os/dashboard exec tsc --noEmit');
    const dashboard = JSON.parse(readFileSync(resolve('apps/dashboard/package.json'), 'utf8'));
    expect(dashboard.name).toBe('@internet-brain-os/dashboard');
  });

  it('CI enforces the root typecheck result', () => {
    const ci = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
    expect(ci).toContain('pnpm typecheck 2>&1 | tee typecheck.log');
    expect(ci).toContain('test "${{ steps.typecheck.outputs.status }}" = "0"');
  });
});
