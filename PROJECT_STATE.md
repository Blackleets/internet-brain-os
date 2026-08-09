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

### Supply chain

- CI performs `pnpm install --frozen-lockfile` and an unfiltered `pnpm audit --prod`.
- The former temporary Nano ID GHSA exception is removed.
- `nanoid@3.3.17` is locked through a workspace override; `nanoid@3.3.16` is forbidden by regression tests.
- Dashboard Chromium acceptance runs as a separate required CI job.
- Windows launcher smoke, first-run reproduction and the internal test package run as release-control gates on relevant `main` changes.

## Canonical CI gate

Every PR and push to `main` must pass:

1. frozen lockfile install;
2. production dependency audit with no GHSA ignore;
3. TypeScript typecheck;
4. full Vitest suite;
5. production build;
6. `pnpm verify:first-run` including Hermes validation, replay and Replay Lab smoke;
7. dedicated Chromium/Playwright dashboard acceptance;
8. affected Windows launcher/first-run/internal-package workflows when their paths apply.

Never quote an old test count as current truth; use the exact current CI run.

## Current operating state

- `main` is the sole implementation source of truth.
- PR #178 is merged; the Goal-first shell is now the product UI baseline, not a pending draft.
- The internal Windows candidate is `0.1.0-internal.4` after the post-`internal.3` user-visible UI changes. Internal candidate identifiers are immutable and must not be reused for a different code state.
- `publicLaunchApproved` remains `false` until UAT-1 through UAT-6 pass on the same immutable candidate: clean Windows install, browser pairing/surfaces, real public-web economic Goal, persistence/replay, second value Goal and truthful failure recovery.
- Work directly on `main` is prohibited; use one bounded implementation branch/PR at a time.
- Do not weaken Kernel authority, replay protection, consent, provenance or local-first secrecy to make a test pass.

## What “green” means here

The agreed MVP implementation lights are green when CI confirms the current `main` contains:

- durable memory authority;
- authentic Hermes boundary;
- native public web discovery/read capabilities;
- bounded Goal/plan/capability/execution primitives;
- Golden Goal-to-notification E2E;
- consolidated browser-tested Goal-first Control Center;
- one-click/self-healing Windows setup;
- strict production dependency audit without exceptions;
- synchronized documentation and machine-checkable release readiness.

The **public release light is separate**: it remains blocked until the manual/internal UAT evidence for the exact candidate is complete. CI success alone is not public-launch approval.

This does **not** mean every long-term idea is shipped. Automatic purchases, a public marketplace, multi-tenant cloud brain, broad connector catalog and native mobile application remain outside this MVP completion claim.

## Next direction after candidate control

Do not add another broad platform subsystem. Product work should refine the existing Goal-first surface and extend the proven Goal → Evidence → Notification loop without changing authority semantics.

The current visual direction is a modern, living Efesto forge rather than a generic admin dashboard: dark cyber-forge foundation, Efesto orange plus restrained electric-blue intelligence accents, a central living brain/forge presence, truthful state motion, and a pixel-smith identity that visually transfers work into the brain. These visuals must remain subordinate to real Goal, Mission, Evidence and Kernel state and must respect reduced-motion/accessibility settings.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix any other project. Read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve Kernel authority, local-first secrecy, Evidence provenance, capability gates, exact replay and altered-replay rejection. Work on exactly one bounded branch and require the full CI + Chromium gate before merge. Treat the Goal-first shell as the UI baseline and keep visual motion truthful to persisted or streaming state.
```

## Update rule

When a merged phase changes the verified baseline, blocker, next priority or recovery procedure, replace stale facts here in the same PR. Do not turn this file into an append-only diary.
