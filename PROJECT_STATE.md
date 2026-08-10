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

### UAT truthfulness hardening — `internal.56` candidate

Pre-UAT audit found one cross-surface truth gap without weakening the G4 security gate: when Hermes was installed but automatic read-only certification failed, the claim gate correctly persisted `automaticBlock`, but Shared Goal Truth discarded that block and clients could render the Mission as queued indefinitely. `internal.56` is the bounded corrective candidate: preserve the block reason in the read projection, map blocked work to non-animated failed work for backward-safe clients, render explicit blocked state on extension/web, and keep the persisted Mission/gates unchanged. The UAT examples are also constrained to the real 120-character Goal-title contract and explicit categories so the founder can execute them through the product UI.

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

Candidate versions are immutable after use. `.41`, `.43`, `.53` and `.54` remain frozen failures and must never be reused.

## Distribution and public launch

- Windows entrypoint remains `Install Efesto.cmd`.
- `INTERNAL_RELEASE.json` is the single candidate identity source.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be fully green while public launch remains blocked pending manual UAT on the exact candidate.

## What remains after G4 implementation merge

1. Qualify immutable `internal.56` across the full automated package matrix, then run manual UAT on that exact green package using a real public-web Goal and verify the full Goal → Evidence-backed Find journey without unauthorized side effects.
2. Establish product baselines before growth claims: Goal → Useful Find Rate, Time to First Useful Find, Repeat Goal Usage, retention and willingness-to-pay; keep unauthorized actions at zero.
3. Improve onboarding/distribution from evidence, not speculative feature count.
4. Treat scheduling expansion, cross-device authority and irreversible actions as separate security slices.

Issue #186 remains the local-first business scorecard.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, Memory Safety v1, Evidence provenance, exact replay and approval gates. G0-G3 are merged; G4 implements revision-bound automatic R0 continuation through safe Hermes discovery, candidate-only persistence, Kernel web.read verification, restart recovery and Shared Goal Truth parity. Search snippets are never Evidence. Never auto-promote R1/R2/R3 side effects or imply phone→PC authority. Finish/verify the exact active candidate before starting a new slice.
```

## Update rule

Replace stale facts here when the verified baseline, blocker, next priority or recovery procedure changes. Do not turn this file into an append-only diary.
