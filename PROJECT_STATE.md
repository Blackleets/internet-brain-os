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
- Memory Safety E1–E5 plus E4 runtime hardening are merged.
- PR #201 adversarially froze malformed-input, integrity, terminal-recovery, replay, cross-memory and read-only-authority contracts.
- **Memory Safety v1 is frozen in `main` at `dff2c2167fd16ad609dd5042ca61ee588d1f7de2`.**
- Terminal memory remains terminal; recovery may authorize only a distinct new candidate identity.
- Prevention and Replay Lab remain read-only and never infer hidden agent intent as authority.

### Goal-first product contract

- PR #202 / G0 merged at `792f5ec128e534a1a5c52fc6fbd304ff9f8762ea`.
- `docs/product-design/goal-first-cross-surface-g0.md` freezes **Forge Focus** and one Kernel-owned persisted Goal truth as the product direction.
- `UniversalGoal` v2 remains the canonical domain target.
- The existing local radar Goal is an explicit compatibility representation until migration is performed additively.
- Goal lifecycle, Mission execution and client-only draft/prepared state remain distinct.
- Automatic behavior means automatic only inside previously confirmed read-only/capability boundaries; side effects and memory authority remain separately gated.
- Existing browser acceptance proves the Goal-first shell on desktop and a 390×844 mobile-width layout without horizontal overflow.
- The Goal-first shell plus living-forge visual layer remain the UI baseline; motion must reflect observable state only and reduced-motion must remain usable.
- `apps/web/landing` remains public acquisition/education only and never receives private Goal or Kernel authority state.

### Authentic agent boundary

- Authentic Hermes v0.19.0 runtime acceptance was proven through the bounded Agent Hub boundary, not simulation.
- Agents may execute authorized work but do not own Goal authority, Evidence truth or memory authority.

## Active bounded phase — G1 Shared Goal Truth v1

PR #203 / branch `agent/shared-goal-truth-g1` is the only active bounded change.

### G1.1 — Kernel projection — validated

- `GoalSurfaceSnapshot v1` schema: `efesto.goal-surface.v1`.
- `sourceOfTruth` is always `kernel`.
- UniversalGoal v2 projects as `universal_v2` with real revision/autonomy/approval policy.
- Current radar Goal projects as explicit `legacy_radar` compatibility with labelled compatibility defaults.
- Goal status and Mission work state remain separate fields.
- Current Mission selection is deterministic and cross-Goal Mission records are excluded.
- Runtime malformed Goal/Mission input fails closed.
- Projection is read-only and grants no capability, approval, external-side-effect or memory authority.

### G1.2 — local read adapter — validated

- `apps/local-kernel/goal-surface-reader.mjs` reads `goals` and `agentMissions` using `LocalKnowledgeStore.read()` only.
- It delegates all Goal/Mission semantics to the Kernel projector.
- It never calls the store project/write path.
- Goal identity is validated before disk read.
- Production composition **lazy-loads** the trusted Kernel projector at the first Goal-surface read instead of requiring `packages/kernel/dist` at source-tree server startup.
- Packaged/installer paths still build the trusted Kernel runtime before normal product launch; if the runtime is genuinely unavailable at read time, the reader fails closed.

### G1.3 — authenticated local HTTP read boundary — validated

- `GET /api/goal-surfaces` returns the Kernel-owned list projection.
- `GET /api/goal-surfaces/:goalId` returns one exact projection or deterministic not-found.
- Routes sit behind the existing `/api/*` token gate and extension identity gate.
- Invalid Goal identity is mapped to a controlled reader error.
- There is no POST/write route under `/api/goal-surfaces`.
- Existing `/api/goals` and Mission write routes remain unchanged and separate.
- The first final candidate exposed a Windows source-tree launcher regression caused by eager Kernel runtime loading; that composition regression is fixed by the lazy-read boundary and `internal.22` is frozen/superseded.

### Important product truth

G1 creates the shared read contract only. **The responsive Control Center does not yet consume it; the extension does not yet consume it.**

- G2 will wire the responsive Control Center to Shared Goal Truth v1.
- G3 will wire the extension to the same projection.
- G4 will prove automatic read-only execution/refresh parity across both clients.
- Mobile-width support does not imply arbitrary phone → PC Kernel remote control; secure cross-device transport requires a separate threat-modelled slice.

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
- `0.1.0-internal.7` through `0.1.0-internal.22` are frozen and must not be reused.
- G1 uses immutable candidate `0.1.0-internal.23`; it is not qualified until the complete final matrix passes on the same final #203 SHA.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be green while public launch remains blocked pending manual UAT on one exact candidate.

## Next bounded sequence

1. G1 Shared Goal Truth v1 — **active; functional layers + startup fix implemented, final `internal.23` qualification pending**.
2. Merge G1 only after final `internal.23` architecture/CI/Chromium/Windows exact-package matrix is green.
3. G2 — responsive Control Center consumes `/api/goal-surfaces`; prove desktop + 390×844 + keyboard/focus/reduced motion.
4. Evaluate and merge G2 before touching extension consumption.
5. G3 — extension consumes the same projection and removes duplicated Goal-state interpretation.
6. Evaluate and merge G3.
7. G4 — prove automatic authorized read-only execution/refresh parity and truthful Finds updates.
8. Cross-device transport, if needed, receives its own security/threat-model slice.

Issue #186 remains the local-first business scorecard and does not block this UX sequence.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, local-first secrecy, Evidence provenance, exact replay, approval gates and Memory Safety v1. Work on one bounded branch at a time. G1 Shared Goal Truth is the current backend truth contract; do not claim web/extension parity until G2/G3. After G1 merge, wire G2 responsive Control Center first, evaluate/merge it, then G3 extension, then G4 automation parity. Never create separate client Goal truth, fake activity, or remote-PC claims without a separately secured transport contract.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
