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
- Hosted/dashboard/Replay Lab surfaces are clients/read models only; Kernel authority, secrets, Evidence and controlled memory remain local-first.

## Verified completion baseline — 2026-08-09

### Evidence, replay and Memory Safety

- Signed local ingestion, HMAC binding, idempotency, exact replay and altered-replay rejection are implemented.
- Cases, Evidence, claims, contradictions, admission and cognitive-pipeline storage are Kernel-owned.
- Memory authority has explicit lifecycle validation, immutable authority receipts, fail-closed transition service, deterministic projection, startup reconciliation and retrieval gating.
- Authority receipts are durable and fail closed on malformed, tampered, corrupt, missing-reference or altered-replay states.
- Only reconciled admitted memory may be reused by reasoning.
- Protected Kernel authority modules are provider-neutral under `pnpm architecture:check`.
- **E1 / #185:** deterministic read-only quarantine recommendations from normalized persisted references; terminal states stay outside the normal quarantine graph.
- **E2 / #187:** append-only durable quarantine recommendation history with identity/integrity checks, exact replay idempotency and explicit stale detection; no authority mutation path.
- **E3 / #188:** terminal recovery review records require human/founder decisions bound to policy/revision; approved recovery names a distinct new candidate and never reopens a terminal ID.
- **E4 / #189:** repeated persisted failures are grouped by exact memory/category inside bounded policy windows and produce deterministic `read_only` prevention guidance with exact failure/reference provenance; no inferred hidden intent or automatic policy/capability/memory changes.
- **E5 / #190:** Replay Lab Memory Safety projection separates `persisted_record`, `human_decision`, and `deterministic_projection` bases, labels current/stale state, preserves exact references, and is queried only through read/list dependencies. The projection exposes no memory transition, recovery approval, policy mutation or capability mutation command.

### Autonomous Goal execution and user value

- Goal and Proposed Plan contracts are capability-bound and deny by default.
- Capability Registry, approval/risk policy, Execution Engine, Scheduler, Trigger Engine, Notification Gateway, Goal Evaluator and Knowledge Graph service are Kernel-owned primitives.
- Native public `web.search` and `web.read` execute through capability/risk gates.
- External side effects remain approval-gated; the Golden path authorizes no purchase, login, form submission or direct memory admission.

```text
Goal
→ authorized web.search
→ authorized web.read
→ Case
→ Evidence
→ Opportunity ranking
→ new-match Trigger
→ deduplicated Notification
```

- Opportunity Radar, local classification, Goal matching, ranking, dedupe, dismissal, private preference learning and Obsidian projection are implemented.
- Finds retain Case/Evidence provenance and remain unverified leads until independently validated.
- Authentic Hermes v0.19.0 runtime acceptance was proven through the bounded Agent Hub boundary; agent authority fields remain rejected/sanitized.

### Operator and product surfaces

- Browser extension provides Forge, Missions, Finds and Models plus state-derived pixel-forge activity.
- Replay Lab is authenticated/read-only and never gains memory authority.
- Control Center is an authenticated loopback client with Goal-first Home, Investigation, Knowledge, Agent Hub, Opportunities, Automations, System and provider-neutral chat.
- The Goal-first shell and living-forge visual layer are wired to existing Kernel contracts rather than decorative fake state.
- Living-forge motion is derived only from observable queued/investigating/verifying/model-thinking state; offline/failed and reduced-motion behavior remain truthful.
- Chromium/Playwright browser acceptance is a required gate.

### Distribution and release qualification

- Windows uses `Install Efesto.cmd` with self-healing prerequisites, runtime builds, owned-process verification and a current-user shortcut.
- No Kernel token or boundary secret is embedded or printed.
- Internal packages bind the exact Git commit through `BUILD_INFO.txt` and SHA-256.
- Exact package qualification downloads the produced artifact, verifies digest/commit, extracts to a path containing spaces, then tests fresh install + paired repair on Windows 2022 and Windows 2025.
- Fresh qualification requires Kernel `alive`/`owned`/`verified`, Hermes readiness and pairing=`required`; paired repair must preserve the original private token digest and leak no Kernel/Hermes secret.

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

## Current operating state

- `main` includes exact-package qualification (#182), architecture/forensic guardrails (#184), E1 (#193), E2 (#194), E3 (#195) and E4 (#196).
- E1–E4 are merged baseline. E5/#190 is the active bounded change.
- `0.1.0-internal.6` remains the immutable previous runtime-readiness candidate.
- `0.1.0-internal.7` through `0.1.0-internal.15` are frozen non-promotable or superseded pre-UAT candidates and must not be reused.
- The current qualification candidate is `0.1.0-internal.16`; it is not qualified until the exact ZIP passes the complete architecture/CI/Chromium/Windows matrix for the final E5 SHA.
- `publicLaunchApproved` remains `false`; manual UAT begins only on the final exact candidate selected after Memory Safety is frozen.
- The **public release light is separate** from implementation readiness: automated qualification can be green while public launch remains blocked until manual UAT passes on the same immutable candidate and approval is explicitly promoted.
- Product/business scorecard is #186. Product Design #192 remains blocked until #191 freezes Memory Safety contracts.
- Work directly on `main` is prohibited; use one bounded implementation branch/PR at a time.

## Next bounded engineering phase

1. #185 quarantine evaluator — **merged**;
2. #187 durable quarantine persistence — **merged**;
3. #188 terminal recovery reviews — **merged**;
4. #189 repeated-failure prevention — **merged**;
5. #190 read-only operator Memory Safety projection — **active**;
6. #191 adversarial contract freeze — **next**.

After #191: implement #186 local-first product measurement, then begin #192 formal Product Design. Any collective analytics remain separately opt-in and privacy-reviewed.

## Product Design gate

Formal Product Design begins only after #191. It must refine the existing Goal-first product, preserve real Kernel state, accessibility/mobile/reduced-motion behavior, and never invent backend state.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve Kernel authority, local-first secrecy, Evidence provenance, capability gates, exact replay and altered-replay rejection. Work on exactly one bounded branch and require architecture + CI + Chromium + Windows exact-package gates before merge. Treat the Goal-first shell plus living-forge visual layer as the UI baseline and keep motion truthful to persisted or streaming state.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
