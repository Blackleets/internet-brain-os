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

## Fix round 1/5

### Corrections

- `KernelClientError` now retains an optional numeric HTTP status only; it still never includes the response body or Kernel token. Model Forge is marked `UNAVAILABLE` only for an actual `404`; `500` remains `HTTP_ERROR`.
- Overview now probes the public readiness routes in parallel first. When `/health` fails specifically as `OFFLINE`, it does not initiate any protected `/api/*` requests. A non-connectivity health failure remains ambiguous and still proceeds with the protected `Promise.allSettled` group.
- Equal activity timestamps use a locale-independent code-unit comparator instead of `localeCompare`.

### Regression evidence

Initial regression RED:

```text
pnpm dashboard:test -- lib/kernel/client.test.ts lib/kernel/overview.test.ts
```

Result: exit 1; the new assertions failed because HTTP status was absent, Model Forge 500 was marked unavailable, protected routes were still initiated after offline health, and locale collation put `goal:é` before `goal:z`.

The ambiguous-health route test was mutation-checked by temporarily suppressing the protected group:

```text
pnpm dashboard:test -- lib/kernel/overview.test.ts
```

Result: exit 1; the ambiguous-health assertion observed no protected routes. The `!offline` condition was restored immediately.

GREEN and final verification:

```text
pnpm dashboard:test -- lib/kernel/client.test.ts lib/kernel/overview.test.ts
# PASS: 2 files / 20 tests

pnpm --filter @internet-brain-os/dashboard typecheck
# PASS

pnpm dashboard:test
# PASS: 5 files / 43 tests

pnpm dashboard:build
# PASS: optimized production build

git diff --check
# PASS
```

## Commit

`59553ec68d31daaaa01f4821efa5aecdf676a7b8 feat(dashboard): compose truthful Overview data`
