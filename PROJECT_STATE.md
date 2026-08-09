# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work. GitHub `main`, CI and the live repository remain the source of truth when newer than this file.

## Identity and invariant

- Product: **HEPHAESTUS / Efesto — The Intelligence Forge**.
- Repository: `Blackleets/internet-brain-os` only. Never mix another project into this tree.
- Hermes and other agents may discover, research and propose.
- The Kernel alone owns Evidence validation, contradiction handling, capability/risk gates, replay, lifecycle transitions, durable-memory authority and controlled persistence.
- **A recommendation is not authority. An agent is never the Kernel. Replay Lab remains read-only.**

## Verified baseline — 2026-08-09

### Core intelligence and authority

- Signed local ingestion, HMAC body binding, idempotency, exact replay and altered-replay rejection are implemented.
- Cases, Evidence, claims, contradiction/admission state and cognitive-pipeline storage are Kernel-owned.
- Memory lifecycle validation, immutable authority receipts, fail-closed transition service, deterministic projection, startup reconciliation and retrieval gating are implemented.
- Only reconciled `admitted` memory may be reused by reasoning.
- Authentic Hermes runtime acceptance is complete through the bounded Agent Hub boundary.
- Goal → authorized public-web research → Case/Evidence → Opportunity ranking → Trigger/Notification is covered end to end.

### Product surfaces

- Goal-first Control Center, extension workspaces, Replay Lab and living Efesto forge are wired to real state.
- Active visual motion is tied to observable queued/investigating/verifying/model-thinking state; offline/failed and reduced-motion modes fail closed visually.
- Chromium/Playwright acceptance is a required gate.

### Windows distribution qualification

PR #182 is merged. `main` commit `44be22cb5c447f20b85a5a72845a1c7221eeeb2b` re-proved the complete automated release gate:

1. frozen install + strict production audit;
2. readiness, typecheck, full tests and production build;
3. first-run E2E and Chromium;
4. Windows launcher, pairing restart, port-conflict and source-package first-run checks;
5. exact immutable ZIP checksum/BUILD_INFO binding;
6. exact ZIP fresh unpaired install + paired repair on Windows 2022 and Windows 2025;
7. Kernel `alive`/`owned`/`verified`, Hermes readiness, trusted shortcut, pairing truth and token-digest preservation;
8. captured repair output must not expose the Kernel token or Hermes boundary credential.

`0.1.0-internal.11` is therefore the frozen fully automated-qualified baseline immediately before Memory Safety expansion. It is **not** public-launch approval.

## Active bounded work — PR #183

Branch: `feat/memory-quarantine-recommendations`.

The first Phase E slice adds deterministic quarantine recommendations while preserving the existing authority boundary:

- persisted-reference-only quarantine signals;
- deterministic normalization and SHA-256 recommendation identity/integrity;
- lifecycle-revision/state staleness detection;
- append-only in-memory repository;
- durable atomic persistence with fail-closed tamper/corruption detection;
- defensive-copy and exact-replay/idempotency behavior;
- Gherkin + negative tests proving a recommendation cannot substitute for `hasPersistedQuarantineSignal` in `MemoryAuthorityTransitionService`.

There is **no** new lifecycle transition, UI write path, agent authority or Replay Lab mutation authority in this slice.

Candidate state:

- `internal.12` is frozen non-promotable because its release-contract test referenced the old UAT-4 heading after Memory Safety expanded the UAT wording; typecheck and Chromium were green, but full Vitest correctly rejected the stale contract.
- `internal.13` is the current immutable candidate for the corrected PR state.
- `publicLaunchApproved=false` remains mandatory.

## Phase E sequence after PR #183

1. merge/re-prove deterministic quarantine recommendations on `main`;
2. add terminal-memory recovery review records that never mutate terminal history;
3. aggregate repeated failures into read-only prevention recommendations;
4. expose those records through forensic/operator read models with provenance and no write authority;
5. freeze state contracts and run the full regression/Windows package gate.

The proposed authority model was checked with Wolfram before implementation: recommendation, recovery-review, agent and Replay Lab authority are false; terminal mutation is impossible; high-impact admission without founder approval is unsatisfiable.

## Product Design gate

Formal Product Design starts only after the Phase E contracts above are stable. It must refine the existing Goal-first product rather than invent fake backend state.

Design baseline: dark cyber-forge, Efesto orange + restrained electric-blue intelligence accents, central living brain/forge, pixel-smith identity, state-truthful motion, mobile containment and reduced-motion support.

## Recovery

```bash
pnpm resume
```

Then inspect `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md`, current GitHub `main`, open PRs and exact CI state. Work on one bounded branch at a time and never weaken authority, provenance, replay or local-first secrecy to make a test pass.

## Update rule

Replace stale facts here in the same PR whenever the verified baseline, active blocker, candidate or next bounded priority changes. Do not turn this file into an append-only diary.
