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
- Hosted/dashboard surfaces are clients only; Kernel authority, secrets, Evidence and controlled memory remain local-first.

## Verified completion baseline — 2026-08-09

### Evidence, replay and memory authority

- Signed local ingestion, HMAC body binding, idempotency, exact replay and altered-replay rejection are implemented.
- Cases, Evidence, claims, contradictions, admission and cognitive-pipeline storage are Kernel-owned.
- Memory authority has explicit lifecycle validation, immutable authority receipts, fail-closed transition service, deterministic projection, startup reconciliation and retrieval gating.
- Authority receipts are durably persisted and reconstruct correctly after restart; malformed, tampered, corrupt, missing-reference and altered-replay states fail closed.
- Only reconciled admitted memory may be reused by reasoning.
- Protected Kernel authority modules are provider-neutral under the executable `pnpm architecture:check` CI gate.
- Memory Safety E1 provides deterministic read-only quarantine recommendations only from normalized persisted reference IDs; it cannot execute a memory-authority transition, and terminal memory states stay outside the normal quarantine graph.
- Memory Safety E2 persists recommendations through separate append-only in-memory/durable repositories. Identity is revalidated before storage; exact basis replay is idempotent; durable history is integrity-bound and replay-validated on restart; stale status is explicit when revision, evaluator version or signal basis changes. Recommendation persistence has no authority-state mutation path.
- Memory Safety E3 records terminal-memory recovery reviews separately. `rejected`, `superseded` and `revoked` memory remain terminal; human/founder review is policy-bound; founder-required decisions fail closed for ordinary humans; approved review must point to a distinct new candidate memory identity. Runtime enum/actor validation, idempotency, integrity, restart and stale-policy checks are enforced.
- Memory Safety E4 derives repeated-failure prevention recommendations only from persisted failure/reference IDs inside a deterministic policy window. Thresholds, failure categories and memory identities remain separated; exact failure replay is deduplicated; conflicting failure identities fail closed; output is explicitly `read_only` and cannot change memory, capabilities, policies or approvals.

### Autonomous Goal execution foundation

- Goal and Proposed Plan contracts are capability-bound and deny by default.
- Capability Registry, approval/risk policy, Execution Engine, Scheduler, Trigger Engine, Notification Gateway, Goal Evaluator and Knowledge Graph service exist as Kernel-owned primitives.
- Native public `web.search` and `web.read` are R0/read-only capabilities executed through the Capability Registry and Execution Engine, not a Hermes bypass.
- External side effects remain policy/approval gated; the Golden path does not authorize purchases, logins, form submissions or direct memory admission.

### Golden economic journey

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

The canonical drill scenario finds a quality candidate inside an €18–€25 budget fixture while preserving source provenance and explicitly performing no purchase. Exact notification replay is idempotent.

### Authentic Hermes boundary

- The external Hermes adapter is shell-free, bounded and sanitized.
- Authentic Hermes v0.19.0 runtime acceptance was proven through the Agent Hub boundary, not simulated.
- Boundary-authority acceptance passed 14/14 checks and live-authentic-runtime acceptance passed 8/8 checks in the recorded acceptance run.
- The real mission completed/forged with 12 findings received and 12 Evidence records created; raw prompts, secrets and unsafe authority fields are not persisted.

### Opportunity intelligence and private learning

- Opportunity Radar, local classification, Goal matching, ranking, dedupe, dismissal and Obsidian projection are implemented.
- Finds retain Case/Evidence provenance and remain explicitly unverified leads until independently validated.
- Preference learning uses only explicit user feedback and is bounded, private and erasable; it never rewrites objective Evidence relevance.

### Operator surfaces

- Browser extension provides Forge, Missions, Finds and Models workspaces plus state-derived pixel-forge activity.
- Replay Lab is an authenticated forensic/read surface and never gains memory authority.
- Control Center is an authenticated loopback client with Investigation, Knowledge, Agent Hub, Opportunity, Automation and System surfaces plus private multi-model chat.
- The Goal-first product shell and living-forge visual layer are wired to existing Kernel contracts rather than decorative fake state.
- Active forge motion is limited to observable queued, investigating, verifying and model-thinking phases; offline/failed states fail closed visually and reduced-motion preferences disable continuous animation.
- The consolidated Control Center passes dedicated Chromium/Playwright browser acceptance.
- The dashboard never receives provider credentials from the Kernel and remains presentation/client-only when hosted.

### Distribution and release qualification

- Windows has a non-technical `Install Efesto.cmd` path with self-healing prerequisites, runtime builds, owned-process verification and a current-user desktop shortcut.
- No Kernel token or boundary secret is embedded or printed by the installer.
- CI uses frozen lockfile installation, production dependency audit, architecture boundary guard, typecheck, full Vitest, production build and first-run verification.
- Dashboard Chromium acceptance runs as a separate required job.
- Windows launcher smoke and first-run reproduction remain release-control gates.
- Internal packages are bound to the exact Git commit through `BUILD_INFO.txt` and SHA-256.
- The packaged-candidate gate downloads the exact artifact, verifies digest/commit, extracts it to a path containing spaces, and tests fresh install + paired repair on Windows 2022 and Windows 2025.
- Fresh qualification requires Kernel `alive`/`owned`/`verified`, Hermes readiness and pairing=`required`; paired repair preserves the original private Kernel-token digest and exposes neither Kernel nor Hermes secrets.
- Failed packaged qualification retains only sanitized diagnostics.

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

- `main` includes exact-package qualification (#182), architecture/forensic guardrails (#184), deterministic quarantine evaluation (#193), durable quarantine persistence (#194), and terminal recovery review (#195).
- E1/#185, E2/#187 and E3/#188 are merged baseline. E4/#189 is the active bounded change.
- `0.1.0-internal.6` remains the immutable previous runtime-readiness candidate.
- `0.1.0-internal.7` through `0.1.0-internal.14` are frozen non-promotable or superseded pre-UAT candidates and must not be reused.
- The current qualification candidate is `0.1.0-internal.15`; it is not qualified until the exact ZIP passes the complete architecture/CI/Chromium/Windows matrix for the final E4 SHA.
- `publicLaunchApproved` remains `false`; manual UAT begins only on the final exact candidate selected after affected Memory Safety work is frozen.
- The **public release light is separate** from implementation readiness: automated qualification can be green while public launch remains blocked until manual UAT passes on the same immutable candidate and approval is explicitly promoted.
- Phase E continues through #189–#191. Issue #186 defines the enterprise product scorecard. Product Design #192 is blocked until #191 freezes Memory Safety contracts.
- Work directly on `main` is prohibited; use one bounded implementation branch/PR at a time.
- Never weaken Kernel authority, replay protection, consent, provenance, secrecy or qualification gates to make a test pass.

## Next bounded engineering phase

1. #185 deterministic quarantine evaluator — **merged**;
2. #187 durable recommendation persistence — **merged**;
3. #188 terminal-memory recovery review records — **merged**;
4. #189 repeated-failure prevention recommendations — **active**;
5. #190 read-only operator exposure;
6. #191 adversarial contract freeze.

Issue #186 defines local-first product/business measurement. Any collective analytics remain separately opt-in and privacy-reviewed.

## Product Design gate

Formal Product Design begins only after #191. It must refine the existing Goal-first surface, preserve real Kernel state, accessibility/mobile/reduced-motion behavior, and never invent backend state.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix any other project. Read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve Kernel authority, local-first secrecy, Evidence provenance, capability gates, exact replay and altered-replay rejection. Work on exactly one bounded branch and require the full architecture + CI + Chromium + Windows packaged-candidate gate before merge. Treat the Goal-first shell plus living-forge visual layer as the UI baseline and keep visual motion truthful to persisted or streaming state.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
