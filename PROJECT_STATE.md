# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work. GitHub `main`, CI and the live repository remain the source of truth when newer than this file.

## Recovery

```bash
pnpm resume
```

Then read `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md`, and the active GitHub item if one exists. The checkpoint preserves **machine-checkable release readiness** language required by continuity and release gates; do not remove those contractual phrases while compacting this file.

## Identity and invariant

- Product: **HEPHAESTUS / Efesto — The Intelligence Forge**.
- Repository: `Blackleets/internet-brain-os` only. Never mix AEGIS, Genesis HQ, APO, Hermes Agent or another project into this tree.
- Hermes and other agents may discover, research and propose.
- The Hephaestus Kernel owns Evidence, validation, contradiction handling, capability/risk gates, replay, durable-memory authority and controlled persistence.
- **An agent is never the Kernel.**
- Dashboard, extension and Replay Lab are clients/read models; private authority stays local-first.

## Verified baseline — 2026-08-09

### Memory Safety v1

- Signed ingestion, idempotency, exact replay and altered-replay rejection are implemented.
- Memory authority lifecycle, immutable receipts, deterministic projection, startup reconciliation and retrieval gating are fail-closed.
- E1 quarantine evaluation, E2 durable recommendation persistence, E3 terminal recovery review, E4 repeated-failure prevention and E5 Replay Lab Memory Safety projection are merged.
- PR #199 hardened E4 runtime boundaries.
- PR #201 adversarially froze E1–E5 with malformed-input, integrity, terminal-recovery, replay, cross-memory and read-only-authority coverage.
- **Memory Safety v1 is frozen in `main` at `dff2c2167fd16ad609dd5042ca61ee588d1f7de2`.**
- Terminal memory remains terminal; recovery may authorize only a distinct new candidate identity.
- Prevention and Replay Lab remain read-only and never infer hidden agent intent as authority.

### Autonomous Goal execution foundation

- Goal/plan contracts, capability/risk policy, Execution Engine, Scheduler, Trigger Engine, Notification Gateway, Goal Evaluator and Knowledge Graph primitives exist.
- Native public `web.search` and `web.read` execute through Kernel-owned capability gates.
- External side effects remain approval-gated; Goal confirmation never grants direct memory authority.
- Existing economic Golden path remains:

```text
Goal
→ authorized public research
→ Case + Evidence
→ Opportunity ranking
→ Trigger / Notification
```

- `packages/kernel/src/goal/goal-contract.ts` defines the long-term `UniversalGoal` v2 domain contract.
- `apps/local-kernel/goals.mjs` still persists a smaller radar-oriented compatibility Goal used by current product routes.
- The dashboard and extension therefore must not independently invent Goal lifecycle meaning while that migration is unfinished.

### Authentic agent boundary

- Authentic Hermes v0.19.0 runtime acceptance was proven through the bounded Agent Hub boundary, not simulation.
- Agents may execute authorized work but do not own Goal authority, Evidence truth or memory authority.

### Current product surfaces

- Browser extension: Forge, Missions, Finds, Models, Goal/radar controls and state-derived living forge.
- Responsive Control Center: Goal-first Home, Missions, Finds, Evidence, Models, Agents, Automations and Settings.
- Existing browser acceptance proves the Goal-first flow on desktop and a 390×844 mobile-width shell without horizontal overflow.
- The Goal-first shell and living-forge visual layer remain the baseline; motion must reflect observable state only.
- `apps/web/landing` is public acquisition/education only, not a private runtime client.

## Active bounded phase — G0 / #192

**Goal-first cross-surface design contract** is the only active bounded change.

The contract is `docs/product-design/goal-first-cross-surface-g0.md`.

G0 decisions:

- one persisted Goal truth owned by the Kernel;
- `UniversalGoal` v2 is the canonical domain target;
- the current radar Goal is an explicit compatibility representation, not a second authority model;
- Goal lifecycle, Mission execution and client-only draft/prepared states stay distinct;
- after one explicit Goal-policy confirmation, allowed read-only work may continue automatically while side effects remain approval-gated;
- responsive Control Center and extension must eventually consume the same read projection;
- public landing never receives Kernel tokens/private Goals;
- 390×844, keyboard, focus, reduced-motion and no-horizontal-overflow requirements are part of the contract;
- mobile-width support does not falsely imply remote control of a PC Kernel across devices;
- exactly three visual directions are documented and **Forge Focus** is selected.

No runtime Goal storage, route or client implementation changes are included in G0.

## Canonical CI gate

Every affected PR/push must pass:

1. frozen lockfile install;
2. architecture boundary guard;
3. strict production dependency audit;
4. TypeScript typecheck;
5. full Vitest suite;
6. production build;
7. `pnpm verify:first-run`;
8. Chromium/Playwright acceptance;
9. Windows launcher smoke and first-run reproduction;
10. exact internal-package generation/integrity binding;
11. exact packaged fresh-install + paired-repair qualification on Windows 2022 and Windows 2025.

Never quote an old test count as current truth; use the exact current CI run.

## Distribution state

- `0.1.0-internal.6` remains the prior runtime-readiness milestone.
- `0.1.0-internal.7` through `0.1.0-internal.20` are frozen and must not be reused.
- G0 uses immutable candidate `0.1.0-internal.21`; it is not qualified until the complete final matrix passes on the same SHA.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be green while public launch remains blocked pending manual UAT on one exact candidate.

## Next bounded sequence

1. G0 / #192 — Goal-first cross-surface design contract — **active**.
2. G1 — Shared Goal Truth v1: Kernel/local-api read projection only; no UI redesign.
3. Evaluate and merge G1.
4. G2 — consume that projection in responsive Control Center; prove desktop + 390×844 + reduced motion.
5. Evaluate and merge G2.
6. G3 — consume the same projection in extension and remove duplicated Goal-state interpretation.
7. Evaluate and merge G3.
8. G4 — prove automatic read-only execution/refresh parity; cross-device transport, if needed, receives its own threat-modelled slice.

Issue #186 remains the local-first business scorecard and does not block this UX sequence.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, local-first secrecy, Evidence provenance, exact replay, approval gates and Memory Safety v1. Work on one bounded branch at a time. The active product direction is Forge Focus. Build Goal truth in order: G1 Kernel read projection, then G2 responsive Control Center, then G3 extension, then G4 automation parity. Never create separate client Goal truth, fake activity, or remote-PC claims without a separately secured transport contract.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
