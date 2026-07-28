# Task 6 Report: Secure Kernel Connection Gate

## Implementation

- Added an in-memory `ConnectionStore` with `get`, `set`, `clear`, and `subscribe`. Its credential and subscriber fields are ECMAScript private fields, so neither is serializable from the store object. No browser persistence API is used.
- Added the client-side connection form with the loopback default URL, a password token input, and autocomplete disabled. The token field is cleared immediately after it is read for submission.
- The gate normalizes the URL, creates `KernelClient`, obtains the truthful `loadOverview` snapshot, and only then commits the connection to the in-memory store.
- Unauthorized responses show the bounded Spanish reconnection message. Errors render no raw exception data, URL, or token.
- Replaced the page placeholder with `ConnectionGate`. The connected state is a deliberately documented minimal internal placeholder; Task 8 owns replacing it with the live Overview composition.

## Files

- `apps/dashboard/lib/session/connection-store.ts`
- `apps/dashboard/lib/session/connection-store.test.ts`
- `apps/dashboard/components/connection-gate.tsx`
- `apps/dashboard/components/connection-gate.test.tsx`
- `apps/dashboard/app/page.tsx`

## TDD Evidence

### RED

```text
pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx
```

Result: exit 1 as expected. Vitest could not resolve `./connection-store` or `./connection-gate`, because both production modules were absent.

### GREEN

```text
pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx
```

Result: exit 0; 2 test files and 5 tests passed.

## Verification

```text
pnpm dashboard:test
# PASS: 7 files / 48 tests

pnpm --filter @internet-brain-os/dashboard typecheck
# PASS

pnpm dashboard:build
# PASS: optimized production build

git diff --check
# PASS
```

The existing Vite CJS Node API deprecation warning and Next workspace-root inference warning were emitted, with no test, typecheck, or build failure.

## Fix round 1/5

### Root cause

Each submit owned an independent asynchronous `loadOverview` continuation, but the gate had no request identity, cancellation controller, or mounted-state guard. A superseded or unmounted continuation could therefore still clear the shared connection store, set an error, or retain its token after a newer request succeeded.

### Corrections

- Each submission now aborts the previous `AbortController`, receives a monotonic request ID, and passes its signal to `loadOverview`.
- Only the mounted, current request may set or clear the connection store, snapshot, error, or connecting state. Unmount invalidates and aborts the active request, then clears the in-memory store.
- Store notification now snapshots listeners and checks membership before invoking them, so an earlier listener can safely unsubscribe a later listener during a notification.

### TDD evidence

RED:

```text
pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx
```

Result: exit 1 as expected. The overlapping-request test exposed the stale Spanish error after a newer success, and the unmount test found the pending request retained its token.

GREEN and final verification:

```text
pnpm dashboard:test -- lib/session/connection-store.test.ts components/connection-gate.test.tsx
# PASS: 2 files / 9 tests

pnpm dashboard:test
# PASS: 7 files / 52 tests

pnpm --filter @internet-brain-os/dashboard typecheck
# PASS

pnpm dashboard:build
# PASS: optimized production build

git diff --check
# PASS
```
