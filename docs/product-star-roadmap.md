# Product Star Roadmap

This roadmap turns the verified HEPHAESTUS / Efesto foundation into a focused release and product plan. It must follow `PROJECT_STATE.md` and live CI when newer than this file.

The goal is not to add random features. The goal is to make the evidence-first intelligence loop useful, trustworthy, easy to install, measurable, and easy to demonstrate without weakening Kernel authority.

## North star

```text
Goal
→ authorized research
→ Case + Evidence
→ Kernel verification
→ Opportunity ranking
→ Trigger / notification
→ controlled memory only after Kernel gates
```

## Verified foundation — 2026-08-09

- Authentic bounded Hermes runtime and provider-neutral Kernel boundary.
- Exact replay safe; altered replay rejected.
- Goal → public research → Evidence → Opportunity → Notification Golden E2E.
- Goal-first Control Center, browser extension, Replay Lab and living Efesto forge.
- One-click/self-healing Windows setup and exact immutable package qualification.
- Architecture guard, strict dependency audit, typecheck, Vitest, build, first-run, Chromium and Windows release gates.
- Memory Safety v1 adversarial contract freeze merged in #201.
- Goal-first cross-surface G0 / #202 merged with **Forge Focus** selected.

## Phase E — Memory Safety v1

Status: **complete**.

- [x] deterministic quarantine signals;
- [x] append-only quarantine persistence and stale detection;
- [x] terminal recovery review with human/founder governance;
- [x] repeated-failure read-only prevention guidance;
- [x] runtime hardening for malformed failure inputs;
- [x] read-only Replay Lab Memory Safety projection;
- [x] adversarial freeze across malformed input, integrity, replay, terminal recovery, cross-memory isolation and read-only authority.

## Phase G — Goal-first product convergence

### G0 / #192 — cross-surface design contract

Status: **complete**.

- [x] one Kernel-owned persisted Goal truth chosen;
- [x] Goal lifecycle / Mission work / client draft states separated;
- [x] automatic behavior bounded by confirmed policy;
- [x] desktop + 390×844 responsive rules;
- [x] extension companion rules;
- [x] public landing isolated from private runtime state;
- [x] accessibility/reduced-motion/no-horizontal-overflow requirements;
- [x] exactly three visual directions documented;
- [x] **Forge Focus selected**;
- [x] bounded G1→G4 sequence frozen.

### G1 — Shared Goal Truth v1

Status: **active; functional layers + startup fix complete, final qualification pending**.

- [x] **G1.1 Kernel projection:** `efesto.goal-surface.v1`, `sourceOfTruth: kernel`, UniversalGoal v2 and explicit `legacy_radar` compatibility, separate Goal lifecycle and Mission work state, deterministic current Mission selection, runtime fail-closed validation.
- [x] **G1.2 local read adapter:** uses `LocalKnowledgeStore.read()` only, delegates semantics to Kernel, validates Goal identity before read, exposes no store project/write path.
- [x] **G1.3 authenticated HTTP read boundary:** `GET /api/goal-surfaces` + `GET /api/goal-surfaces/:goalId`, existing token/extension identity gates, deterministic not-found/invalid-id behavior, no Goal-surface write route.
- [x] source-tree startup hardening: Goal-surface production composition lazy-loads the trusted Kernel projector at first read so launcher startup does not require `packages/kernel/dist` before a Goal-surface request; packaged installs still build the Kernel runtime before launch.
- [x] contract/unit/adapter/HTTP/Gherkin coverage.
- [ ] qualify immutable `0.1.0-internal.23` on the final #203 SHA and merge.

`internal.22` is frozen/superseded because its first final matrix exposed the eager Kernel-runtime startup regression on Windows launcher/pairing smoke. The regression was fixed without weakening G1.1/G1.2 semantics or modifying the launcher.

Important: G1 is backend/shared truth only. The current Control Center and extension are not yet claimed to consume it.

### G2 — responsive Control Center consumption

Next after G1 merge.

- consume `/api/goal-surfaces` instead of interpreting Goal/Mission state independently;
- preserve Forge Focus hierarchy;
- prove desktop + 390×844;
- preserve keyboard/focus/reduced motion;
- derive living-forge activity only from real Goal/Mission truth;
- do not touch extension consumption in G2.

### G3 — extension consumption

After G2 merge:

- consume the same Shared Goal Truth v1 projection;
- remove duplicated Goal-status interpretation;
- keep extension identity/pairing gates;
- remove redundant read-only Research confirmation only when the persisted Goal policy already permits that work;
- preserve current-page radar/capture as a separate explicit workflow.

### G4 — automation parity

After G3 merge:

- prove automatic authorized read-only work, scheduler/refresh behavior and Finds updates are consistent across clients;
- preserve approval gates for external side effects;
- do not infer activity from timers/animation;
- any remote phone → PC Kernel access requires a separate secure cross-device transport threat model.

## Enterprise measurement — #186

Primary KPIs:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Repeat Goal Usage.

Drivers/guardrails include mission completion/failure, install-to-first-Goal activation, Find usefulness/dismissal, notification delivery, altered-replay acceptance = 0, unauthorized memory admission = 0, credential/privacy leakage = 0, and exact package install/repair success.

Initial measurement remains local-first. Aggregate sharing requires a separate opt-in privacy design.

## Distribution / release closeout

- `0.1.0-internal.6` remains the prior runtime-readiness candidate.
- `0.1.0-internal.7` through `0.1.0-internal.22` are frozen and must not be reused.
- G1 uses final candidate `0.1.0-internal.23`; its evidence must map to one final SHA.
- Public launch remains blocked until an exact candidate passes automated qualification plus manual UAT and explicit promotion.

## What not to do

Do not:

- turn Efesto into a generic scraper/admin dashboard;
- let Hermes/agents write durable memory or Goal authority;
- let Goal confirmation bypass side-effect approvals;
- collapse Goal status and Mission phase into one invented state machine;
- keep separate persisted Goal truth in dashboard and extension;
- add a Goal-surface write route just because a read projection exists;
- make source-tree launcher startup depend eagerly on a built Goal projection runtime;
- display fake activity or animate work that was not observed;
- push private Goals or Kernel tokens into the public landing;
- claim arbitrary mobile remote-PC control while the trust boundary is loopback;
- redesign Kernel, dashboard and extension in one PR;
- reuse an immutable internal candidate identity after package contents change.

## Next bounded sequence

1. Finish G1 and qualify/merge `internal.23`.
2. Open a new G2 branch from the merged G1 main commit.
3. Wire responsive Control Center only to Shared Goal Truth v1 and prove desktop/mobile-width accessibility.
4. Evaluate + merge G2 before touching extension consumption.
5. Implement/evaluate G3 extension consumption.
6. Implement/evaluate G4 automatic-work parity.
7. Wire #186 measurements only through explicit local-first contracts.
8. Freeze exact candidate → manual UAT → public promotion decision.

## Definition of “project star”

```text
Install exact qualified package
→ local Kernel proves readiness
→ one confirmed Goal policy
→ one Kernel-owned persisted Goal truth
→ Shared Goal Truth v1 read projection
→ responsive Control Center + extension consume the same truth in later bounded slices
→ automatic authorized read-only work
→ Evidence + provenance
→ useful Finds
→ approval-gated side effects
→ replay-safe controlled memory
→ mobile-width usability without fake remote authority
→ measurable user value while preserving privacy
```
