# Task 3 report — Define and Parse Kernel Contracts

## Implementation

- Added Phase 1 dashboard contract types for the public Kernel readiness, bootstrap, authenticated collection, and Model Forge responses.
- Added dependency-free parsers that validate response envelopes, arrays, non-empty identifiers, bounded published states, and Phase 1 scalar fields.
- Added `KernelContractError`, which includes the invalid field path without serializing source payloads.
- Preserved optional Kernel record data on accepted mission records so the Overview can later render persisted summaries without duplicating the Kernel store schema.
- Added complete bounded fixtures mirroring the currently documented local Kernel route envelopes, including the full Model Forge catalog returned by the current Kernel implementation.

## Files

- `apps/dashboard/lib/kernel/contracts.ts`
- `apps/dashboard/lib/kernel/parse.ts`
- `apps/dashboard/lib/kernel/parse.test.ts`
- `apps/dashboard/test/fixtures.ts`

## TDD evidence

RED command:

```text
pnpm dashboard:test -- lib/kernel/parse.test.ts
```

Result: failed as expected because `./parse` did not exist (`Failed to load url ./parse`).

GREEN command:

```text
pnpm dashboard:test -- lib/kernel/parse.test.ts
```

Result: passed, 1 file / 12 tests.

## Verification

```text
pnpm --filter @internet-brain-os/dashboard typecheck
```

Result: passed.

```text
pnpm dashboard:test
```

Result: passed, 3 files / 22 tests.

```text
git diff --check
```

Result: passed.

## Self-review

- Parsers do not import or depend on URL normalization, fetch, React, or Kernel implementation modules.
- Fixtures use the actual local route field names (`executionPhase` and `attempt`) rather than the outdated illustrative aliases (`phase` and `attempts`).
- The parser accepts only published state values and rejects invalid envelopes, non-arrays, empty IDs, and invalid states.
- No Kernel, extension, UI, manifest, lockfile, or documentation files were changed.

## Concerns

- The dashboard test command still emits the pre-existing Vite CJS Node API deprecation warning; it did not affect test results.
- The contracts intentionally cover only Phase 1 rendered data. Future Kernel response additions should remain optional until the dashboard renders them.
