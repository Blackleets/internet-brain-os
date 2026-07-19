# Handoff 2026-07-20 - GPT-5.5 Thinking - Hermes idempotency hardening

## What changed

- Merged the native Hermes JSONL extractor phase into `main` through PR #56.
- Created Issue #57 to validate the secured Hermes ingestion path with real runtime output from console, Telegram, or file logs.
- Added `scripts/hermes-idempotency-attack-test.mjs` in PR #58.
- Added `pnpm hermes:attack-smoke`.
- Fixed the local Hermes HTTP route so idempotency conflicts map to explicit `409` responses instead of falling through as generic ingestion failures.
- Added route-level tests for idempotency conflict status mapping.
- Updated the Hermes ingestion contract and CHANGELOG to document attack-smoke validation.

## Important merged PRs

- PR #56: `feat(hermes): extract native JSONL output`
- PR #58: `test(hermes): add idempotency attack smoke`

## Current Hermes ingestion commands

```bash
pnpm build
pnpm hermes:smoke
pnpm hermes:attack-smoke
```

With a running local Kernel:

```bash
IBOS_HERMES_SECRET=dev-secret pnpm kernel:serve
IBOS_HERMES_SECRET=dev-secret pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
IBOS_HERMES_SECRET=dev-secret pnpm hermes:ingest-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

## Current safety behavior

- First valid signed Hermes ingestion returns `202`.
- Exact replay with the same idempotency key returns `202` and the original cognitive record id.
- Altered payload with the same idempotency key returns `409 HERMES_IDEMPOTENCY_CONFLICT`.
- In-progress duplicate ingestion returns `409 HERMES_INGESTION_IN_PROGRESS`.
- Hermes still cannot submit Kernel authority fields such as `validation`, `contradiction`, `admission`, `candidate`, `claim`, `durableClaim`, or `knowledgeAdmission`.

## Files touched in PR #58

- `scripts/hermes-idempotency-attack-test.mjs`
- `package.json`
- `docs/hermes-ingestion-contract.md`
- `CHANGELOG.md`
- `packages/kernel/src/orchestration/hermes-local-ingestion-http-route.ts`
- `packages/kernel/test/hermes-local-ingestion-http-route.test.ts`

## Why it matters

The system now proves that idempotency protects semantic meaning, not just request success. A compromised or buggy Hermes client cannot reuse a known idempotency key to sneak in a changed claim after a successful run.

## Validation performed

- PR #58 CI passed after the HTTP status mapping fix.
- PR #58 was merged to `main` with merge commit `c2511a183a10e775f2eb0c0bb7cdc2ef562f755b`.

## Risks / uncertainties

- The smoke and attack-smoke scripts require a local checkout with dependencies and build output.
- Real Hermes runtime output still needs to be captured and tested against Issue #57.
- If real Hermes output differs from the bounded JSON or explicit JSONL formats, add only a thin extractor that maps it into the existing bounded contract.

## Next recommended step

Run Issue #57 with actual Hermes output:

1. Capture one real Hermes execution output.
2. Test it with `pnpm hermes:ingest-agent` or `--native-jsonl`.
3. Confirm replay behavior.
4. Confirm altered idempotency-key attack rejection.
5. Add a format-specific extractor only if the real runtime output shape requires it.

## Do not forget

- Keep Hermes as evidence/claim producer only.
- Keep Kernel authority over validation, contradiction, admission, persistence, recovery, and idempotency receipts.
- For ingestion-related changes, run `pnpm build`, `pnpm hermes:smoke`, and `pnpm hermes:attack-smoke`.
