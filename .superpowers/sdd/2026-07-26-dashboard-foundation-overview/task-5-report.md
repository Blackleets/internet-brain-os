# Task 5 Report: Compose a Truthful Partial-Failure Overview

## Implementation

- Added `loadOverview(client, signal?)`, which reads the eight Phase 1 Kernel routes with `Promise.allSettled` and preserves every successfully parsed collection when another route fails.
- Added a typed snapshot containing truthful readiness, count metrics, persisted missions and opportunities, deterministic activity, a load timestamp, and typed endpoint issues.
- Activity is created only from persisted Goal, Mission, and Opportunity record IDs, timestamps, and states; invalid timestamps are omitted rather than invented. Equal timestamps sort by the stable derived activity ID.
- A failed health probe marks the Kernel offline. Any `UNAUTHORIZED` response is rethrown to the caller. Model Forge HTTP failures become the typed optional `UNAVAILABLE` issue while the rest of the snapshot remains available.

## Files

- `apps/dashboard/lib/kernel/overview.ts`
- `apps/dashboard/lib/kernel/overview.test.ts`

## TDD Evidence

### RED

```text
pnpm dashboard:test -- lib/kernel/overview.test.ts
```

Result: exit 1 as expected. Vitest failed to load `./overview` because the production module did not yet exist.

### GREEN

```text
pnpm dashboard:test -- lib/kernel/overview.test.ts
```

Result: exit 0; 1 test file and 3 tests passed.

## Verification

```text
pnpm --filter @internet-brain-os/dashboard typecheck
# PASS

pnpm dashboard:test
# PASS: 5 files / 38 tests

pnpm dashboard:build
# PASS: optimized production build

git diff --check
# PASS
```

## Scope concern

`KernelClientError` currently exposes an `HTTP_ERROR` code but not the HTTP status. Consequently, the Overview can truthfully preserve and classify the required Model Forge `404` test response as optional unavailable, but cannot distinguish another Model Forge HTTP status (such as 500) without an out-of-scope client contract extension. No client change was made.

## Commit

`59553ec68d31daaaa01f4821efa5aecdf676a7b8 feat(dashboard): compose truthful Overview data`
