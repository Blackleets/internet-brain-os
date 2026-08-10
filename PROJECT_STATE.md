# HEPHAESTUS — Current Project State

Canonical short checkpoint. GitHub `main`, live CI and the active PR are authoritative when newer than this file. This checkpoint preserves **machine-checkable release readiness** language required by continuity and release gates.

## Recovery

```bash
pnpm resume
```

Then read `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md` and the active GitHub item. Work only in `Blackleets/internet-brain-os`; never mix AEGIS, Genesis HQ, APO, Hermes Agent or another project into this tree.

## Identity and authority

- Product: **HEPHAESTUS / Efesto — The Intelligence Forge**.
- Hermes and other agents discover, research and propose. **An agent is never the Kernel.**
- Hephaestus owns Evidence, capability/risk gates, contradiction handling, replay, durable-memory authority and controlled persistence.
- Dashboard, extension and Replay Lab are clients/read models. Replay Lab remains read-only over memory authority.
- Exact replay is safe; altered replay is rejected.
- Automatic authority in G4 is limited to explicitly authorized R0 `web.search` and `web.read`; purchases, logins, forms, messages, file mutation, payments and other external side effects remain separately approval-gated.
- Responsive mobile-width support does not imply arbitrary phone → PC Kernel authority. Cross-device transport requires its own threat model.

## Verified foundation — 2026-08-09

### Memory Safety v1 ✅

PR #201 froze adversarial Memory Safety v1 at `dff2c2167fd16ad609dd5042ca61ee588d1f7de2`. Terminal memory remains terminal, recovery requires a distinct candidate identity, malformed/corrupt authority fails closed, exact replay is idempotent and altered replay is blocked.

### Goal-first product surfaces ✅

- PR #202 / G0: Forge Focus and one Kernel-owned Goal truth. The **Goal-first shell** and **living-forge** visual baseline remain machine-checkable release-readiness contracts.
- PR #203 / G1: Shared Goal Truth v1 (`efesto.goal-surface.v1`, `sourceOfTruth: kernel`) with authenticated read-only list/detail routes.
- PR #204 / G2: responsive Control Center consumes Shared Goal Truth; desktop, 390×844, focus/keyboard and reduced-motion acceptance are green.
- PR #205 / G3: extension parser/transport/Living Forge/Goal chips consume the same projection; legacy Mission history remains compatibility telemetry, not Goal authority.

### Authentic agent boundary ✅

**Authentic Hermes v0.19.0 runtime acceptance was proven** through the bounded Agent Hub boundary, not simulation. Agents may execute authorized work but do not own Goal, Evidence or memory authority.

## G4 — automatic authorized read-only parity

PR #206 / branch `agent/automatic-read-only-g4`.

Qualified layers:

- `internal.39` — automatic-read-only policy: active Goal alone is not authority; exact Goal-id/revision receipt required; only trusted interactive/founder actors and R0 observe capabilities may continue.
- `internal.40` — trusted confirmation receipt persistence; token-only or client-supplied authorization cannot self-promote.
- `internal.42` — automatic claim eligibility through real `web.search` CapabilityRegistry + policy; `.41` frozen after release-identity-only failure.
- `internal.44` — authorization before attempt/lease; denial burns no attempt; `.43` frozen after a storage-shape-only test failure.
- `internal.45` — authentic Hermes automatic discovery restricted to `--safe-mode --toolsets search -z`; incompatible runtime fails closed.
- `internal.46` — Hermes output persists as deterministic `searchCandidates`; search snippets create zero Case/Evidence/Find; exact candidate replay is idempotent.
- `internal.47` — one-click enables automatic discovery only after read-only runtime certification.
- `internal.48` — private connectors package emits trusted runtime JS; installer and daily launcher build/repair it.
- `internal.49` — Kernel-owned `web.read` re-fetches candidate URLs through `PublicWebReadExecutionAdapter(WebPageFetcher)`; authority is checked before network I/O and again before persistence; only fetched page content becomes Evidence.
- `internal.50` — one-click automatically continues `verifying` Missions through the existing authenticated `/results` boundary into Kernel verification; no second authority endpoint.
- `internal.51` — restart recovery resumes queued/verifying work, promotes `waiting_for_agent` only when the adapter becomes ready, and never steals an unexpired lease.
- `internal.52` — cross-surface semantics: Shared Goal Truth remains the web/extension source; one explicit research authorization precedes autonomous harmless reads; subsequent `web.search`, `web.read`, safe retry and recovery add no new harmless-read prompt.

Canonical automatic value loop now implemented:

```text
explicit trusted Goal research authorization
→ revision-bound receipt
→ CapabilityRegistry + automatic-read-only policy
→ bounded lease
→ Hermes safe search-only discovery
→ persisted searchCandidates
→ Kernel-authorized web.read
→ fetched public source
→ Case + Evidence
→ Opportunity/Find
→ Shared Goal Truth on web + extension
→ restart-safe continuation
```

Critical epistemic rule: **search snippet ≠ Evidence**. Agent text never becomes trusted Evidence merely because Hermes returned it.

## G4 final freeze

`internal.53` is frozen and non-promotable because its final adversarial freeze test referenced an obsolete source filename after the package artifact had already been produced. `internal.54` is also frozen and non-promotable because the complete suite found one continuity-contract omission in this checkpoint after its package artifact had already been produced: the literal phrase `machine-checkable release readiness` had been compacted away. Neither failure changed runtime behavior. `internal.55` is the frozen G4 implementation candidate and must never be reused.

### UAT truthfulness hardening — `internal.56` ✅

PR #207 merged at `01a5241ba7de93afe084d42a72e74a59b7fb1128`. `internal.56` is frozen after full automated qualification. It preserves `automaticBlock` through Shared Goal Truth, renders blocked automatic work truthfully instead of fabricating queued progress, keeps persisted Mission/gate authority unchanged, and aligns UAT Goal examples with the real 120-character title contract.

## G5.1 — local-first product value scorecard ✅

PR #208 merged at `4f9cfc5fc113366d35532fecfd0403c09f29a471`. `internal.57` is frozen after the complete automated and post-merge matrix passed. The Kernel-local read model implements Issue #186 without central telemetry or new authority and derives product evidence only from existing local provenance plus explicit private Find feedback.

Measured when the local denominator exists:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Mission completion rate;
- Finds per completed Goal;
- useful/saved Find share;
- Mission failure rate;
- Find dismissal/not-interested rate.

Explicitly `not_measurable` until the required ledger exists:

- Repeat Goal Usage as a user-cohort rate;
- installation → first Goal activation;
- Goal → notification delivery;
- altered-replay acceptance event count;
- unauthorized-memory admission event count;
- credential/privacy incident count;
- packaged install/repair success inside the local runtime store.

The scorecard is exposed additively as `profile.productScorecard` through the existing authenticated read-only `GET /api/preferences`. It uploads nothing, creates no telemetry endpoint, grants no capability and does not alter Goal, Evidence, Mission, Opportunity or memory authority.

## G5.2 — responsive dashboard scorecard ✅

PR #209 merged at `97f47669d8d0ef16a3127db63a503ce33a9cdaad`. `internal.59` is frozen after the complete pre-merge and post-merge automated matrix passed, including Chromium/Playwright and exact packaged install/repair on Windows 2022 and Windows 2025.

The dashboard consumes the G5.1 Kernel scorecard on the active `EfestoProductShell` Home surface without creating a second metric truth.

- `/api/preferences` is loaded in parallel with the other authenticated Overview reads.
- The dashboard parser accepts only `efesto.product-scorecard.v1`, `sourceOfTruth: local_kernel`, `privacy.mode: local_only` and `externalTelemetry: false`.
- `not_measurable` requires `value: null`; it can never be rendered as a fabricated zero.
- The active Home surface receives `snapshot.productScorecard`; the visual component performs formatting only and has no fetch, Kernel client, telemetry or product-metric calculation path.
- A scorecard failure degrades only the scorecard panel; Cases, Goals, Missions, Finds and system readiness remain usable.
- Desktop and 390×844 acceptance verify the visible Useful Find Rate, Time to First Useful Find and `Solo local · sin telemetría externa` statement without horizontal overflow.

### `internal.58` frozen failure

`internal.58` is frozen and non-promotable. Architecture, dependency audit, release-readiness, typecheck, the full Vitest suite, build, Windows launcher, Windows first-run and exact internal package generation were green, but Chromium acceptance failed after the package had already been produced. Root cause was bounded to the E2E Kernel fixture: the active dashboard correctly added authenticated `GET /api/preferences`, while the fixture still lacked that route and produced console 404 errors. Production scorecard behavior and authority were unchanged.

### `internal.59` corrective freeze ✅

`internal.59` kept the G5.2 production implementation unchanged and corrected only the acceptance boundary: the E2E fixture serves a contract-valid local-only scorecard and Playwright verifies that same scorecard on desktop and 390×844. The full matrix passed before merge and repeated green on `main` after merge.

## G5.3 — authentic public-web journey acceptance

Candidate `internal.60` strengthens the existing explicit `pnpm hermes:acceptance:live` path instead of creating a second executor or production code path.

The existing live checks remain:

- **L1** authentic Hermes reaches terminal `completed` state;
- **L2** attempts remain bounded at three or fewer.

G5.3 adds provenance checks:

- **L3** authentic discovery persisted at least one bounded `searchCandidate`;
- **L4** Kernel `web.read` independently verified at least one candidate and created Evidence;
- **L5** at least one promoted Find matches the exact tested Goal;
- **L6** the Find resolves through Case/Evidence to the same Mission and candidate with `kernel-web-read-v1`, a `web-read:` receipt, fetched text and content hash;
- **L7** Shared Goal Truth reports `sourceOfTruth: kernel`, the same Mission id and `workState: forged`.

The live probe uses a bounded public-learning Goal and an isolated temporary Kernel data directory. It collects proof only through authenticated Kernel APIs (`/api/agent-missions`, `/api/opportunities`, `/api/browser/case/:id`, `/api/goal-surfaces/:goalId`), not by reading the store directly. Search snippets remain non-Evidence; the proof is based on provenance rather than text inequality.

Default CI remains deterministic: the real Internet/Hermes journey runs only through the already explicit live command. Normal CI runs unit/contract tests for the assessment logic without requiring Internet or a live account.

## Canonical CI/release gate

Every affected candidate must pass on one unchanged SHA:

1. frozen lockfile install;
2. architecture boundary guard;
3. strict `pnpm audit --prod`;
4. TypeScript typecheck;
5. full Vitest suite;
6. production build;
7. `pnpm verify:first-run`;
8. Chromium/Playwright acceptance;
9. Windows launcher smoke and first-run reproduction;
10. exact internal-package generation and SHA binding;
11. exact packaged fresh-install + paired-repair qualification on Windows 2022 and Windows 2025.

Candidate versions are immutable after use. `.41`, `.43`, `.53`, `.54` and `.58` remain frozen failures and must never be reused.

## Distribution and public launch

- Windows entrypoint remains `Install Efesto.cmd`.
- `INTERNAL_RELEASE.json` is the single candidate identity source.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be fully green while public launch remains blocked pending manual UAT on the exact candidate.

## What remains

1. Qualify immutable `internal.60` across the complete deterministic automated release matrix.
2. Execute the explicit live acceptance on an environment with authentic Hermes + public Internet and require L1→L7; a green deterministic CI run alone does not claim this live proof.
3. Run manual UAT on one exact green packaged candidate using a real public-web Goal and verify Goal → Evidence-backed Find without unauthorized side effects.
4. Use the Kernel-owned scorecard to establish real baselines from observed usage before setting growth targets; never invent retention, willingness-to-pay or cohort metrics that the local data cannot support.
5. Treat scheduling expansion, cross-device authority and irreversible actions as separate security slices.

Issue #186 remains the local-first business scorecard.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, Memory Safety v1, Evidence provenance, exact replay and approval gates. G0-G4 are frozen; G5.1 measures local product value, G5.2 surfaces the same Kernel-owned scorecard on the active responsive dashboard, and G5.3 strengthens the existing explicit live Hermes acceptance to require Candidate → Kernel Evidence → Goal-linked Find → Shared Goal Truth provenance. Search snippets are never Evidence. Never auto-promote R1/R2/R3 side effects, introduce central telemetry, or imply phone→PC authority. Finish/verify the exact active candidate before starting a new slice.
```

## Update rule

Replace stale facts here when the verified baseline, blocker, next priority or recovery procedure changes. Do not turn this file into an append-only diary.
