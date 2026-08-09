# Plan de Mejora — Efesto Engineering Closeout

> Canonical truth: `PROJECT_STATE.md`, live GitHub `main`, and the exact current CI run.

## Release engineering — automated gate complete

- [x] Exact immutable ZIP bound to Git SHA by SHA-256 + BUILD_INFO.
- [x] Fresh unpaired install from that ZIP on Windows 2022 and Windows 2025.
- [x] Shared, Kernel and extension runtimes built from the extracted package.
- [x] Kernel `alive`, `owned`, `verified`; Hermes ready; pairing state truthful.
- [x] Trusted desktop shortcut.
- [x] Safe shutdown through the trusted Node launcher.
- [x] Paired repair from the same package.
- [x] Existing Kernel-token digest preserved across repair.
- [x] Captured repair output checked for credential leakage.
- [x] PR #182 merged and the same full gate re-proved on `main`.

`internal.11` is the frozen pre-Memory-Safety automated-qualified baseline. Public launch remains blocked.

## Current work — Phase E / PR #183

- [x] Deterministic quarantine recommendation evaluator implemented.
- [x] Only persisted deterministic references may feed a recommendation.
- [x] Signal normalization, duplicate replay handling and altered-signal replay rejection.
- [x] SHA-256 identity/integrity binding.
- [x] Lifecycle revision/state staleness detection.
- [x] Append-only in-memory repository.
- [x] Durable atomic repository with corruption/tamper fail-closed behavior.
- [x] Defensive-copy and replay/idempotency tests.
- [x] Gherkin authority-boundary scenarios.
- [x] Regression proving recommendation ≠ `hasPersistedQuarantineSignal` lifecycle authority.
- [x] Wolfram formal check: zero satisfiable unsafe authority states under the proposed Phase E rules.
- [x] Freeze `internal.12` after CI correctly detected a stale release-contract assertion.
- [x] Advance corrected state to `internal.13`.
- [ ] Make the exact `internal.13` PR SHA fully green: audit, readiness, typecheck, tests, build, first-run, Chromium and both exact-package Windows jobs.
- [ ] Merge #183 only with expected-head SHA protection.
- [ ] Re-prove the merged `main` SHA through the same gates.

## Next bounded implementations

1. **Terminal Recovery Reviews** — append-only review records for rejected/superseded/revoked memory; never mutate terminal history; any restoration path creates a new linked `proposed` candidate.
2. **Repeated-Failure Prevention** — deterministic aggregation of repeated forensic failures into read-only prevention recommendations.
3. **Operator Read Model** — provenance-rich exposure of quarantine/recovery/prevention recommendations without mutation authority.
4. **Contract freeze** — full negative/replay/corruption/Gherkin/integration regression pass.
5. **Product Design formalization** — only then use the Product Design workflow against stable real states.

## Manual UAT / public promotion

Manual UAT stays intentionally blocked until the current post-Memory-Safety candidate is fully automated-qualified. Public promotion additionally requires UAT-1 through UAT-6 on the same immutable artifact. `publicLaunchApproved` remains false until that evidence exists.

## Engineering rules

1. Kernel authority stays local-first and fail-closed.
2. Agents propose; the Kernel validates, admits, transitions and persists.
3. Recommendations/reviews are data, not authority.
4. No fake UI state or synthetic release claims.
5. One bounded branch/PR at a time; never patch `main` directly.
6. Every shipped behavior or release-validation change advances the immutable internal candidate.
7. CI green is necessary; public launch additionally requires real UAT evidence.
