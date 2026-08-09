# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work. GitHub `main`, CI and the live repository remain the source of truth when newer than this file.

## Recovery

```bash
pnpm resume
```

Then read `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md`, and the active GitHub item if one exists.

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
- Memory Safety E1 adds a pure Kernel-owned quarantine-signal evaluator. It can produce deterministic read-only recommendations only from normalized persisted reference IDs; it cannot execute a memory-authority transition, and terminal memory states stay outside the normal quarantine graph.

### Autonomous Goal execution foundation

- Goal and Proposed Plan contracts are capability-bound and deny by default.
- Capability Registry, approval/risk policy, Execution Engine, Scheduler, Trigger Engine, Notification Gateway, Goal Evaluator and Knowledge Graph service exist as Kernel-owned primitives.
- Native public `web.search` and `web.read` are R0/read-only capabilities executed through the Capability Registry and Execution Engine, not a Hermes bypass.
- External side effects remain policy/approval gated; the Golden path does not authorize purchases, logins, form submissions or direct memory admission.

### Golden economic journey

The canonical Golden E2E proves this bounded user-value path in one test:

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

The drill scenario finds a quality candidate inside an €18–€25 budget fixture while preserving source provenance and explicitly performing no purchase. Exact notification replay is idempotent.

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
- PR #178 merged the Goal-first Efesto product shell: Home/Goal, Missions, Finds, Evidence, Models/chat, Agents, Automations and Settings are wired to existing Kernel contracts rather than decorative fake state.
- The product shell is responsive and preserves explicit confirmation before Goal execution; chat remains separate from Evidence and durable memory.
- The living-forge visual layer adds the Efesto pixel smith, central brain/forge staging, orange + restrained electric-blue intelligence accents and state-derived data-flow motion without adding synthetic product state.
- Active forge motion is limited to observable queued, investigating, verifying and model-thinking phases; offline/failed states fail closed visually and reduced-motion preferences disable continuous animation.
- The consolidated Control Center and Goal-first shell pass dedicated Chromium/Playwright browser acceptance on the current architecture.
- The dashboard never receives provider credentials from the Kernel and remains presentation/client-only when hosted.

### Distribution

Windows has a non-technical double-click path:

1. Double-click `Install Efesto.cmd`.
2. The installer checks/repairs Node.js 22+, pinned pnpm 11.11.0 and frozen-lockfile workspace dependencies.
3. It builds Shared, Kernel and the browser extension before launching the trusted local runtime.
4. It starts/repairs the trusted local Efesto launcher and verifies the owned process truthfully.
5. It creates an owner-local desktop shortcut.
6. `Efesto Launcher.cmd` self-heals missing prerequisites instead of exposing raw package-manager errors.

No Kernel token or boundary secret is embedded or printed by this installer.

The release qualification layer requires the **exact generated ZIP**, rather than only a checkout of the same source, to be checksum-bound, extracted and tested through both a fresh unpaired installation and a paired repair before manual UAT can begin.

### Supply chain and release qualification

- CI performs `pnpm install --frozen-lockfile` and an unfiltered `pnpm audit --prod`.
- The former temporary Nano ID GHSA exception is removed.
- `nanoid@3.3.17` is locked through a workspace override; `nanoid@3.3.16` is forbidden by regression tests.
- Dashboard Chromium acceptance runs as a separate required CI job.
- Windows launcher smoke and first-run reproduction remain release-control gates.
- The internal package is bound to its Git commit through `BUILD_INFO.txt` and SHA-256.
- The packaged-candidate gate downloads that exact artifact, verifies its digest/commit, extracts it to a path containing spaces and tests it on Windows 2022 and Windows 2025.
- Fresh qualification starts with no Kernel token and no authorized extension, discards the one-time pairing console output, and requires Kernel `alive`/`owned`/`verified`, Hermes readiness, pairing=`required`, runtime builds and a trusted desktop shortcut.
- The owned Kernel is then stopped through the trusted Node launcher, a synthetic local extension identity is authorized, and the same package runs repair again with captured output.
- Paired repair must preserve the original private Kernel-token digest, return Kernel `alive`/`owned`/`verified`, preserve pairing=`paired`, and expose neither the Kernel token nor Hermes boundary credential in captured repair output.
- Failed packaged qualification retains only a sanitized diagnostic artifact.

## Canonical CI gate

Every PR and push to `main` must pass, when affected:

1. frozen lockfile install;
2. architecture boundary guard;
3. production dependency audit with no GHSA ignore;
4. TypeScript typecheck;
5. full Vitest suite;
6. production build;
7. `pnpm verify:first-run` including Hermes validation, replay and Replay Lab smoke;
8. dedicated Chromium/Playwright dashboard acceptance;
9. Windows launcher smoke and first-run reproduction;
10. exact internal-package generation and integrity binding;
11. exact packaged fresh-install + paired-repair qualification on Windows 2022 and Windows 2025.

Never quote an old test count as current truth; use the exact current CI run.

## Current operating state

- `main` is the implementation source of truth and includes exact packaged qualification from PR #182 plus the architecture/forensic guardrails from PR #184.
- The Goal-first shell plus living-forge identity layer is the current product UI baseline.
- `0.1.0-internal.6` remains the immutable previous runtime-readiness candidate.
- `0.1.0-internal.7` through `0.1.0-internal.11` are frozen non-promotable or superseded pre-UAT candidates and must not be reused.
- The current qualification candidate is `0.1.0-internal.12`; it is not qualified until the exact ZIP passes the complete CI/Chromium/Windows packaged matrix for the final merged code state.
- `publicLaunchApproved` remains `false`. Manual UAT-1 through UAT-6 may begin only after automated packaged qualification is green on the same immutable candidate.
- Phase E is tracked through issues #185 and #187–#191. Issue #186 defines the enterprise product scorecard. Product Design issue #192 is blocked until Memory Safety contracts are frozen.
- Work directly on `main` is prohibited; use one bounded implementation branch/PR at a time.
- Do not weaken Kernel authority, replay protection, consent, provenance, secrecy or qualification gates to make a test pass.

## What “green” means here

The agreed MVP implementation lights are green only when the current `main` proves:

- durable memory authority;
- authentic Hermes boundary;
- native public web discovery/read capabilities;
- bounded Goal/plan/capability/execution primitives;
- Golden Goal-to-notification E2E;
- consolidated browser-tested Goal-first Control Center;
- one-click/self-healing Windows setup;
- strict production dependency audit without exceptions;
- provider-neutral architecture boundary enforcement;
- exact packaged Windows candidate integrity;
- exact packaged fresh-install + paired-repair qualification on the supported Windows matrix;
- synchronized documentation and machine-checkable release readiness.

The **public release light is separate**: it remains blocked until manual/internal UAT evidence for the same exact candidate is complete. Automated success alone is not public-launch approval.

This does **not** mean every long-term idea is shipped. Automatic purchases, a public marketplace, multi-tenant cloud brain, broad connector catalog and native mobile application remain outside this MVP completion claim.

## Next bounded engineering phase

Complete Memory Safety without changing the core authority model:

1. #185 — deterministic quarantine-signal evaluator and read-only recommendation contract;
2. #187 — persist/read quarantine recommendations without transition authority;
3. #188 — explicit terminal-memory recovery review records, separate from automatic state mutation;
4. #189 — repeated-failure aggregation into read-only prevention recommendations;
5. #190 — forensic/operator exposure with provenance and no Replay Lab write authority;
6. #191 — contract freeze plus full adversarial regression and acceptance gates.

Issue #186 defines the product/business measurement layer. Initial measurement must remain local-first; any collective analytics remain separately opt-in and privacy-reviewed.

## Product Design gate

Formal Product Design begins only after the engineering contracts above are stable. Issue #192 is intentionally blocked until #191 closes. The design work must refine the existing Goal-first surface, not invent a second product or fake backend state.

The living forge should expose real Mission/Evidence activity around the central brain without duplicating Kernel state or turning the product into a dense admin dashboard. Visual direction remains: dark cyber-forge foundation, Efesto orange plus restrained electric-blue intelligence accents, central living brain/forge presence, pixel-smith identity, and motion that mirrors real persisted/streaming state. Mobile and reduced-motion behavior remain first-class acceptance constraints.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix any other project. Read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve Kernel authority, local-first secrecy, Evidence provenance, capability gates, exact replay and altered-replay rejection. Work on exactly one bounded branch and require the full architecture + CI + Chromium + Windows packaged-candidate gate before merge. Treat the Goal-first shell plus living-forge visual layer as the UI baseline and keep visual motion truthful to persisted or streaming state.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
