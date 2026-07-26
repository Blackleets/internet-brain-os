# Task 11 — Repository Gates and Dashboard Documentation

Date: 2026-07-26
Base: `ced8dbc17a6d13467ef38e5cd7c8ca40db72f99b`

## Completed scope

- Root `build` runs `tsc -b` and the dashboard production build.
- Root `test` excludes only `apps/dashboard/e2e/**`, so Playwright specifications
  are executed by their dedicated runner rather than loaded by Vitest.
- The dashboard README documents the exact local startup commands, loopback URL,
  tab-memory token handling, token-file location without its contents, and the
  Phase 1 boundary.
- Architecture and recovery documentation describe the dashboard as a
  presentation-only authenticated loopback client.

## Verified gates

| Command | Result | Fresh output |
| --- | --- | --- |
| `pnpm typecheck` | passed | `tsc -b --pretty false` exited 0 |
| `pnpm test` | passed | 93 test files / 540 tests |
| `pnpm build` | passed | root TypeScript build and dashboard Next production build |
| `pnpm verify:first-run` | passed | 93 test files / 540 tests plus Hermes validation, smoke, attack-smoke, and Replay Lab API smoke |
| `pnpm --filter @internet-brain-os/dashboard e2e` | passed | 3 Chromium tests |

The Next build emitted its existing multiple-lockfile workspace-root warning;
this task intentionally does not modify Next configuration.

## Test harness correction

Before the root-test exclusion, `pnpm test` was red because Vitest collected
`apps/dashboard/e2e/overview.spec.ts` and Playwright rejected its
`test.beforeEach` hook outside the Playwright runner. The failed run otherwise
reported 93 passing files / 540 passing tests. Excluding only
`apps/dashboard/e2e/**` restored the intended split: the root unit suite is
green and the same E2E specification runs separately in the dedicated
three-test Playwright gate above.

## Deliberate boundaries

Phase 1 does not claim completion of Knowledge Graph projections, full
Investigations workflows, or a scheduler. Efesto remains the primary capture and
consent surface, Replay Lab remains the advanced forensic surface, and the
Kernel remains the sole authority for persistent domain state.
