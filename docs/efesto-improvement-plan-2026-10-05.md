# Efesto improvement and qualification plan — 2026-10-05

## Scope and baseline

Founder authorization: improve Efesto autonomously while preserving everything already present. Canonical repository: Blackleets/internet-brain-os. This branch starts at PR #252 head a258ca3b5bb7a9aece4f7679711f0addec6e5809, which includes the #251 Forge v3 candidate and its bounded Kernel worker repair. It is a candidate, not the deployed main branch or the founder's Windows installation. No deletion or migration of user records is needed.

The preserved invariants are the crawler/spider/anvil/canvas, source provenance, SUPPORT implementation, Kernel ownership, local storage, memory/replay protection, revision-bound approval, bounded search/retry, and publicLaunchApproved=false. No new provider, paid service, dependency, telemetry upload, or authority is introduced.

## Delivered slice: recoverable transport and Goal editing

| Defect | Change | Acceptance evidence |
| --- | --- | --- |
| A Kernel response can return headers and stall during body reading; the worker swallowed its abort as empty JSON | Preserve the request deadline through JSON decoding and distinguish malformed JSON from timeout | Worker body-stall regression; failure-report and lost-response reconciliation tests |
| Missing lease or malformed submission could reach the adapter or produce a false completed worker result | Require a leased mission before execution and confirm the same mission is verifying/completed; reconcile persisted state if the response is incomplete | Negative missing-lease/unconfirmed-response tests; existing verifying/replay tests |
| Authenticated requests followed redirects by default | Reject redirects in worker bookkeeping and both dashboard JSON/NDJSON transport | Transport regression assertions; authenticated API behavior tests |
| Dashboard body timeout appeared as invalid JSON | Keep TIMEOUT distinct from INVALID_RESPONSE | Response-body deadline regression |
| Goal revision callback rejection left the editor pending | Retain user text, restore controls, show a generic unconfirmed-save alert, guard duplicate submissions and freeze editing during submission | Save-failure recovery test |
| Modal keyboard focus could leave Goal editing | Wrap Tab/Shift+Tab among enabled dialog controls | Unit keyboard regression plus desktop/mobile Playwright assertions |

Rollback: revert this branch's improvement commit only. The #252 baseline and its original fixes remain available. No data rollback is required. Invalid/unconfirmed server responses now fail closed instead of appearing successful; this is the intended compatibility change.

## Deep qualification sequence

1. **Foundation and reliability:** architecture guard, strict production audit, release-readiness contract, TypeScript, full tests, SQLite persistence, dashboard build, extension package, first-run and exact/altered replay. Deterministic tests do not prove external Hermes or Windows UAT.
2. **Product behavior:** desktop and 390×844 browser acceptance; Goal create/edit/reconfirm, Buscar más retaining earlier Evidence/Finds, no-SUPPORT outcomes, reconnect, reduced motion, visible controls, focus and overflow. Use the existing Chromium CI suite; local browser download availability is an environment condition, not a green result.
3. **Immutable Windows candidate:** bind source SHA and artifact, run launcher/fresh-install/paired-repair qualification, then manual UAT on the founder's exact installation. Preserve existing private store and settings; never install over it without the existing backup/repair path.
4. **Authentic value:** real public-web Goals with source receipts, SUPPORT reasons and shared Goal truth. Capture successful Find, irrelevant page, unreadable source, no-result, restart and recoverable-error cases. Existing live proof on an older SHA cannot certify this candidate.
5. **Intelligence improvements after qualification:** measure useful/saved Finds, time to first useful Find and repeat usage locally. Improve query specificity or candidate selection only against measured failures, without weakening SUPPORT or promoting snippets. Avoid adding speculative infrastructure or cosmetic churn.
6. **Distribution:** public release only after exact-candidate UAT. A hosted dashboard is presentation-only; it does not create phone-to-PC authority, an Android app or a cloud Kernel. Notification delivery needs actual installed extension/OS evidence.

## Evidence record for this work

- Final full suite: 267 files, 1789 tests passed.
- Focused final regressions, typecheck, build, SQLite (7 tests), smoke/replay and extension packaging are recorded in the session handoff.
- Production audit: no known vulnerabilities reported.
- Local Chromium installation failed because the download returned an invalid/truncated ZIP. Browser acceptance must be reported from the exact published CI SHA, not inferred.
- No access to the founder's running Windows Kernel was available. Screenshots of prior runs are historical evidence, not a new UAT pass.

Every subsequent report must distinguish planned, implemented, deterministic-tested, browser-tested, authentic-runtime-tested, installed and public-release states.
