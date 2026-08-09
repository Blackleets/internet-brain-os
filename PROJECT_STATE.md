# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work. GitHub `main`, CI and the live repository remain the source of truth when newer than this file.

## Recovery

```bash
pnpm resume
```

Then read `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md`, and the active GitHub item if one exists. This checkpoint preserves **machine-checkable release readiness** language required by continuity and release gates.

## Identity and authority invariant

- Product: **HEPHAESTUS / Efesto — The Intelligence Forge**.
- Repository: `Blackleets/internet-brain-os` only. Never mix AEGIS, Genesis HQ, APO, Hermes Agent or another project into this tree.
- Hermes and other agents may discover, research and propose.
- The Hephaestus Kernel owns Evidence, validation, contradiction handling, capability/risk gates, replay, durable-memory authority and controlled persistence.
- **An agent is never the Kernel.**
- Dashboard, extension and Replay Lab are clients/read models; private authority stays local-first.
- Exact replay is safe; altered replay is rejected.

## Verified baseline — 2026-08-09

### Memory Safety v1

- PR #201 froze adversarial Memory Safety v1 at `dff2c2167fd16ad609dd5042ca61ee588d1f7de2`.
- Terminal memory remains terminal; recovery may authorize only a distinct new candidate identity.
- Quarantine, recovery review, prevention and Replay Lab projections remain read-only where specified and fail closed on malformed runtime input.

### Goal-first cross-surface contract

- PR #202 / G0 merged at `792f5ec128e534a1a5c52fc6fbd304ff9f8762ea`.
- Forge Focus, one Kernel-owned persisted Goal truth, truthful motion, explicit authority and responsive 390×844 behavior are frozen product requirements.
- The Goal-first shell and living-forge visual baseline remain machine-checkable release-readiness contracts; do not remove those phrases during checkpoint compaction.
- Mobile-width support does not imply arbitrary phone → PC Kernel remote control; secure cross-device transport requires its own threat-modelled slice.

### Shared Goal Truth v1 backend

- PR #203 / G1 merged at `48f949a0de3eb6cff5b579ebeba3ad9ef8995a43`.
- Schema is `efesto.goal-surface.v1`; `sourceOfTruth` is always `kernel`.
- `GET /api/goal-surfaces` and `GET /api/goal-surfaces/:goalId` are authenticated read-only routes.
- Goal lifecycle and Mission work state remain separate.
- `UniversalGoal` v2 is the canonical target; current radar Goals remain explicit `legacy_radar` compatibility records.
- No POST/write route exists under `/api/goal-surfaces`.

### Responsive Control Center — G2

- PR #204 merged at `2a7ca903f8e2d686f19ec3402149651d9adcec08`.
- Web client parsing is fail-closed and Home/Living Forge uses Shared Goal Truth instead of duplicated Mission interpretation.
- Desktop, 390×844 mobile-width, keyboard/focus and reduced-motion Chromium acceptance are green.
- Goal/Mission writers remain unchanged and explicit confirmation remains required.

### Extension Shared Goal Truth — G3

- PR #205 is the bounded extension convergence slice represented by this checkpoint; live Git determines whether it is still under review or already merged.
- Extension parser validates the same Shared Goal Truth schema/source fail-closed.
- Extension list/detail transport is authenticated HTTP loopback GET-only and rejects invalid tokens, endpoints and Goal IDs before network access.
- Living Forge and `mission-state` are read-only Shared Goal Truth projections; read failure becomes an explicit unavailable/error presentation rather than stale legacy success.
- Goal chips render from Shared Goal Truth, preserve Kernel ordering and display explicit compatibility/autonomy/work-state labels.
- Every Research control uses its own Goal `workState` and projected `canResearch`.
- The existing `startGoalResearch` path remains the writer and still requires the explicit user authorization prompt.
- Legacy Mission history remains a read-only compatibility ledger; it is not Goal authority.
- Shared Goal Truth refresh follows observable Mission revision changes; no independent unbounded Goal polling loop was added.
- Reduced-motion remains available for the extension forge.

### Authentic agent boundary

- **Authentic Hermes v0.19.0 runtime acceptance was proven** through the bounded Agent Hub boundary, not simulation.
- Agents may execute authorized work but do not own Goal authority, Evidence truth or memory authority.

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

- `0.1.0-internal.7` through `0.1.0-internal.37` are frozen after use and must never be reused.
- G3 final cross-surface freeze uses candidate `0.1.0-internal.38`; it is qualified only if the complete final matrix passes on one unchanged HEAD.
- `0.1.0-internal.37` produced a Windows package and is frozen; it is not promotable because the full CI suite exposed a missing UAT contract literal after package qualification.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be green while public launch remains blocked pending manual UAT on one exact candidate.

## Next bounded sequence

1. Finish/merge G3 only if final `internal.38` architecture/CI/Chromium/Windows exact-package matrix is green on the same HEAD.
2. G4 — prove automatic authorized read-only execution/refresh parity and truthful Finds updates across the converged web + extension surfaces.
3. Evaluate Goal → Useful Find, time-to-first-useful-find and repeat-Goal signals from local-first measured data; do not invent product targets before a real baseline.
4. Cross-device transport, if needed, gets its own security/threat-model slice before any phone → PC remote authority claim.
5. Public promotion remains a separate exact-candidate UAT decision.

Issue #186 remains the local-first business scorecard and does not weaken this UX/security sequence.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, local-first secrecy, Evidence provenance, exact replay, approval gates and Memory Safety v1. Shared Goal Truth v1 is the single persisted Goal read model for responsive web and extension. Finish G3 only through its exact green internal.38 candidate, then execute G4 automatic authorized read-only parity. Never create separate client Goal truth, fake activity, automatic side effects, or remote-PC claims without a separately secured transport contract.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
