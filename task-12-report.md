# Task 12 — final visual QA and responsive hardening

The source-normalized pass closed every P0/P1/P2 visual finding without changing Kernel contracts or inventing Phase 2 data:

- persistent shell readiness follows the live connection store;
- ready/paired copy is concise Spanish;
- desktop density fits the 1536 × 1024 reference viewport;
- the malformed tablet grid declaration is repaired so the mobile breakpoint executes;
- mobile metrics collapse to one readable column with no horizontal overflow;
- decorative Forge artwork is hidden at the 390 × 844 breakpoint as intended;
- Turbopack is pinned to the isolated repository root, removing machine-dependent workspace inference.

TDD evidence: mobile overflow failed at 422 px against a 390 px viewport before the CSS parser fix; the Forge slot then failed the new hidden assertion before the specificity fix. Final focused and canonical checks passed: dashboard 73/73, E2E 3/3, typecheck and production build.

Visual evidence and the truthful Phase 1 residual boundary are recorded in `design-qa.md`, which ends with `final result: passed`.

## Production dependency security (P0) — closed

The only unresolved P0 from the handoff was production dependency security. Closure:

- Baseline `pnpm audit --prod`: **7 high / 6 moderate** (13 total).
  - `next@16.2.10` (<16.2.11): 5 high + 4 moderate (Turbopack single-locale bypass, Server Actions DoS, 2× SSRF in Server Actions, rewrites SSRF, cache confusion ×2, Edge unbounded Server Action, SVG image-optimization DoS, internal Server Function endpoint disclosure).
  - `postcss@8.4.31` (via `next`): 2 high (arbitrary file read GHSA-6g55-p6wh-862q, source-map path traversal GHSA-r28c-9q8g-f849) + 1 moderate (stringify XSS).
  - `sharp@0.34.5` (via `next`): 1 high (libvips CVE-2026-33327/33328/35590/35591).
- Fix (minimal, TDD-gated):
  - `apps/dashboard/package.json`: `next` `16.2.10` → `^16.2.11`.
  - `pnpm-workspace.yaml`: added `overrides: { postcss: '>=8.5.18', sharp: '>=0.35.0' }`. NOTE: pnpm v11 no longer reads `pnpm.overrides` from the root `package.json`; overrides must live in `pnpm-workspace.yaml`. A first attempt that placed them in `package.json` was ignored by pnpm and left the vulnerable postcss/sharp in the graph.
  - Regenerated `pnpm-lock.yaml` deterministically (`pnpm install`, no `--force`, supply-chain policy verified).
- Result `pnpm audit --prod`: **No known vulnerabilities found** (0 high / 0 moderate).
- Resolved graph: `next@16.2.11`, `postcss@8.5.23`, `sharp@0.35.3`.
- Windows EPERM mitigation: confirmed no Next/Vite/Playwright build process owned `node_modules` in this worktree before install (only unrelated global `playwright-mcp` from the npm cache was running; left untouched).

Gate evidence: `git diff --check` clean, `pnpm audit --prod` clean, `pnpm typecheck` exit 0, `pnpm test` 94 files / 547 tests, `pnpm dashboard:test` 77/77, `pnpm --filter @internet-brain-os/dashboard build` clean (Next 16.2.11), `pnpm --filter @internet-brain-os/dashboard e2e` 3/3, `pnpm verify:first-run` exit 0.

## CI `pnpm test` failure — closed

CI run #374 failed at the `pnpm test` step (build and verify:first-run were skipped). Root cause was not dependency security but a non-portable vitest exclude glob:

- `package.json` `test` script used `--exclude apps/dashboard/e2e/**`. On Windows/MSYS the glob excluded `apps/dashboard/e2e/overview.spec.ts`, so `pnpm test` passed locally; on Linux CI the glob did not exclude the file, so vitest collected the Playwright spec and failed with `Playwright Test did not expect test.beforeEach() to be called here.`
- First fix attempt (`exclude: ['**/e2e/**']` in `vitest.config.ts` plus `--exclude '**/e2e/**'` in the script) over-collected `node_modules` and `dist` test files (Next.js embedded specs, `packages/kernel/dist/*.test.js`) because an explicit `exclude` replaces vitest's default excludes instead of merging.
- Final fix: `vitest.config.ts` now uses `exclude: [...configDefaults.exclude, '**/e2e/**']` (merges vitest defaults with the e2e exclusion) and the `test` script is back to `vitest run --passWithNoTests` (no CLI `--exclude`, so the config is the single source of truth and behaves identically on Linux and Windows).

Verified locally after fix: `pnpm test` 94 files / 547 tests passed (no `node_modules`/`dist`/`e2e` collection); `pnpm build`, `dashboard build`, `dashboard e2e` 3/3, and `verify:first-run` all green. CI rerun expected to pass the `pnpm test`, `build` and `verify:first-run` steps.
