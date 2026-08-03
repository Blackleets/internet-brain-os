# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work after a lost, compacted, or unavailable chat. GitHub and the live Git state remain the source of truth when they are newer than this document.

## Recovery command

```bash
pnpm resume
```

Then read, in order:

1. `PROJECT_STATE.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. The active GitHub issue or pull request
5. The target implementation and tests

## Project identity

- Product: **HEPHAESTUS — The Intelligence Forge**.
- Technical repository: `Blackleets/internet-brain-os`.
- Do not mix this repository with APO, Genesis HQ, AEGIS, Hermes Agent, or any other project.
- Hermes is the external discovery/tool/execution layer.
- Hephaestus is the evidence, validation, memory, causality, and knowledge-forging Kernel.

## Stable completed baseline

- Secure local Hermes ingestion, HMAC body binding, idempotency, replay protection, recovery, and startup reconciliation.
- Mission execution, claim proposal, contradiction, knowledge admission, and durable cognitive-pipeline storage.
- Replay Lab read model, authenticated local API, smoke test, and minimal operator UI with a safe pre-ingestion authority-boundary explanation.
- Replay Lab Causality Map derived only from explicit persisted evidence, proposal, gate, contradiction, admission, and durable-claim links.
- Replay Lab AI Autopsy and Prevention projections derived deterministically from recorded state, with observed facts separated from interpretation and all prevention proposals read-only pending human approval.
- Replay Lab real-capture import flow with separate read-only validation and explicit ingestion, server-side HMAC signing, sensitive-data preflight, bounded input, and automatic case refresh; the browser never receives the Hermes boundary secret.
- Efesto Opportunity Radar extension experience with explicit per-site authorization, automatic background capture into the user's loopback Kernel, sensitive-page/query/selection blocks, local cooldown, and visible readiness for Kernel, Hermes, Ollama, and Obsidian.
- Extensible deterministic local Opportunity classifier and authenticated Inbox spanning work, funding, clients, savings, food, public aid, learning, events, housing, travel, collaboration, rewards, and useful tools; promoted leads retain their Case/Evidence provenance, concrete benefit type, explainable relevance signals, raw deadline text, source, and next action, and are projected into the user's private Obsidian-compatible vault.
- Private local Goals with bounded categories, keywords, optional location, and priority; Goal matches add explainable personalized ordering without altering Evidence relevance and synchronize only to the user's own Obsidian-compatible vault.
- Explicitly consented, idempotent Goal research missions for the Hermes Agent Hub boundary; disconnected agents remain visibly `waiting_for_agent`, and mission scope contains only the Goal fields authorized by the user.
- Private, erasable preference learning from explicit Opportunity feedback (`useful`, `saved`, `dismissed`, `not_interested`); bounded category, benefit, and public-source adjustments personalize Inbox ordering without rewriting objective Evidence relevance or exporting the profile.
- Authenticated local Hermes worker transport for consented missions with expiring leases, at most three observable attempts, bounded public-result validation, sensitive/private URL rejection, Evidence preservation, Kernel-owned Opportunity classification, Goal-scope enforcement, deduplication, and private Obsidian projection. An authentic external Hermes runtime connection remains to be proven rather than simulated.
- Agent Hub result delivery is response-loss tolerant: completed-result retries are idempotent, persisted Obsidian receipts are preserved, and the worker reconciles an ambiguous result response through the authenticated mission list before reporting failure.
- Shell-free Hermes mission worker for an explicitly configured external adapter, with bounded JSON stdin/stdout, failure reporting, and observable Agent Hub mission states in the extension. No Hermes executable is bundled; authentic runtime proof still requires the user's configured Hermes instance.
- Shared fail-closed Hermes runtime detection for the one-click Kernel and readiness doctor. The standard Windows install, an explicit executable, or a real `PATH` entry may activate the bundled adapter; a missing executable can no longer be reported as ready. The doctor reuses an existing private Kernel token without printing its value or path and keeps the explicit legacy adapter contract compatible.
- Authenticated local Model Forge inspection with loopback-only Ollama detection, coarse hardware tiers, curated compatible model recommendations, installed/active model distinction, and manual setup instructions; it never installs software, pulls models, changes configuration, or grants model output Evidence authority.
- Living pixel-forge extension scene driven only by observable Agent Hub and manual-capture states; the smith rests, prepares, works, celebrates, or surfaces failure without inventing agent activity, and honors reduced-motion preferences.
- Forge-centered extension information architecture with four bounded workspaces—Forge, Missions, Finds, and Models—plus real Goal and Opportunity counts; navigation changes presentation only and preserves all Kernel authority, consent, and provenance contracts.
- State-derived smith onboarding across Kernel connection, first Goal, per-site radar authorization, and first Find; named mission stages select the truly newest persisted mission and never fabricate percentage progress, while Goal commissions and provenance-backed Finds use the forge visual language.
- Evidence-first Find details that keep objective relevance separate from personalized ordering, label every promoted item as an unverified lead, and expose retained signals, related Goal, Evidence provenance, cautions, and a safe next action without claiming confidence or safety.
- Mission Forge Ledger cards derived only from persisted mission state, attempts, timestamps, bounded failure records, and result summaries; the extension exposes received findings, created Evidence, promoted opportunities, and an auditable activity timeline without inventing percentage progress or an unpersisted live verification phase.
- Additive persisted mission execution phases distinguish Hermes investigation, Kernel verification, and completed forging without changing compatible mission terminal states; the pixel smith changes from hammering to inspection only while the Kernel has durably entered verification.
- Bounded live Agent Hub refresh while the extension popup is visible, with fast active-state updates, queued/idle backoff, hidden-popup pause, non-overlapping requests, temporary-Kernel-failure tolerance, and one-time Finds refresh when a newly observed mission is forged.
- Local Mission Watchtower for terminal Agent Hub transitions while the popup is closed, using a one-minute Manifest V3 alarm, authenticated loopback reads, persistent bounded deduplication, generic privacy-preserving desktop notifications, and an unread result center that opens the Forge Ledger without advancing mission state.
- Explainable Opportunity Command Center that preserves the Kernel's private Inbox order, identifies the first Find to inspect, and exposes its Goal match, objective Evidence relevance, personalized ordering, unconfirmed deadline signal, provenance-first next action, and unverified status without inventing confidence or acting automatically.
- Safe Action Workspace for each Find with a bounded category-aware manual-review checklist stored only in extension-local storage; progress never becomes Evidence, verification, authority, or an automatic action and is capped at 100 Find records.
- Opportunity dismissal atomically updates the persisted Find status so dismissed leads leave the Inbox; mission summaries count only newly created Evidence, and the public-result boundary rejects IPv6 loopback, link-local, unique-local, and IPv4-mapped private sources.
- Safe local `/status` readiness contract for Kernel, Hermes, Replay Lab, Ollama, and Obsidian; Ollama is reported configured only when an actual model is configured, without exposing model or endpoint details.
- Shared `efesto.bootstrap-status.v1` readiness contract for Kernel, Hermes, Obsidian, extension pairing, safe user-facing setup messaging, technical diagnostics, and recoverable launcher actions; Windows launcher work starts the one-click Kernel without exposing tokens, uses one persisted Obsidian vault path for both reported status and Kernel writes, and shuts down only a strongly verified launcher-owned process.
- Local API tokens reject whitespace/control characters; persisted POSIX token files fail closed when group or world permissions are present, and rotation remains explicit.
- Hephaestus Control Center: an authenticated loopback dashboard with a truthful Overview plus Kernel-backed Investigation, Knowledge, Agent Hub, Opportunity, Automation, and System workspaces. Goal creation, explicitly confirmed Hermes mission launch, and private Opportunity feedback use existing authenticated Kernel mutations. Its persistent multi-model composer supports loopback Ollama and HTTPS OpenAI-compatible providers configured by each user; provider credentials stay in the owner-private Kernel store and are never returned to the dashboard, while model output remains explicitly unverified and outside durable memory. The operator-entered Kernel token stays in tab memory by default. Knowledge Graph remains visibly unavailable until the Kernel exposes an authenticated projection.
- Control Center conversation streaming and history: Ollama NDJSON and manually configured OpenAI-compatible SSE stream through the authenticated loopback Kernel with an explicit stop action. Only completed exchanges enter the bounded owner-private conversation store; cancelled partial output is not committed, and conversation history remains separate from Evidence, Claims, Cases, and controlled memory.
- Internal Orchestrator phases A-C: task contracts/state, bounded Hermes/Codex prompts, report validation, and Git evidence decisions.
- PR #76: approval invariants hardened.
- PR #77: filesystem-backed Internal Orchestrator CLI merged with cross-process mutation locking, explicit blocked-task retry, founder gates, and corruption visibility.
- PR #78: durable continuity checkpoint and `pnpm resume` recovery command merged.
- PR #79: clean Kernel runtime build and deterministic Hermes replay/attack smoke repaired.
- PR #85: safe local readiness endpoint merged from a clean `main` branch.
- PR #86: one-command `pnpm verify:first-run` gate merged and proven in CI.
- PR #87: truthful Ollama readiness contract merged and proven in CI.
- PR #92: deterministic Causality Map, AI Autopsy, and read-only Prevention proposals merged and proven in CI.
- PR #94: local API token validation and fail-closed POSIX permission handling merged and proven in CI.
- PR #96: authenticated real Hermes capture validation and explicit signed ingestion from Replay Lab merged and proven in CI.
- PR #100: canonical Hermes acceptance state corrected on the current Efesto baseline.
- PR #102: authentic-worker readiness doctor, safe environment template, and adapter contract merged.
- PR #103: authentic Efesto mission adapter merged (2026-07-22). The adapter translates bounded Hermes Agent output into Kernel execution events through the already-secured signed ingestion path; it does not bundle a Hermes executable and does not by itself prove a live external Hermes runtime.
- Issue #10: Internal Orchestrator v0 closed as completed with PR #73–#77 evidence.
- Issue #57: real Hermes runtime acceptance completed with a sanitized authentic local Hermes session; signed ingestion, exact replay, altered-replay conflict rejection, authority-field rejection, and Replay Lab visibility were proven without persisting raw prompts, responses, tool output, credentials, tokens, or secrets.
- PR #129: fully wired Kernel Control Center merged (2026-07-28). Adds `apps/local-kernel` chat service, model-provider registry, authenticated `/api/*` wiring, and the dashboard Kernel workspaces UI (Investigation, Knowledge, Agent Hub, Opportunity, Automation, System). The dashboard is presentation-only and connects to the loopback Kernel; Knowledge Graph projection and a general scheduler are NOT implemented and remain explicitly unavailable in the UI.
- PR #130: `.hephaestus/` and `.hermes/` added to `.gitignore` so local runtime state, tokens, config, logs, and artifacts never enter the repository (merged 2026-07-28).
- Fresh local validation on 2026-07-26: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm verify:first-run` passed. The unit suite reported 93 test files / 540 tests; the dashboard E2E suite reported 3 passing Chromium tests. The root build includes the dashboard production build, while Vitest explicitly excludes Playwright E2E specifications. The observed Next workspace-root warning is deferred and does not change the loopback-only dashboard boundary.
- Fresh local validation on 2026-08-03 on the bounded delivery branch: focused mission tests passed (41 tests), full `pnpm test` passed (106 files / 621 tests), `pnpm typecheck`, `pnpm build`, Hermes validators, Hermes smoke, altered-replay attack smoke, and Replay Lab API smoke passed. This does not prove a live external Hermes runtime or visual browser acceptance.

## Current operating state

- `main` is the sole source of truth and includes the Efesto extension product surface, Opportunity and Goal workflows, Agent Hub transport, Model Forge, pixel-forge activity, deterministic forensic read path, real-capture importer, local token-file hardening, the Hephaestus Control Center dashboard, and the local Kernel chat/conversation wiring from PR #129.
- Current bounded delivery branch: `codex/goal-10-10-mission-reliability`. It contains the first implementation increment for the founder's 10/10 goal: idempotent mission completion and safe worker reconciliation across the Kernel, worker, and Obsidian receipt boundary.
- Open implementation/design tasks: PR #125 (design only — memory quarantine and toxic-memory lifecycle; no runtime enforcement). There is no active code-change task in this checkpoint.
- Open issues: #98 (design memory quarantine) and #101 (prove Agent Hub worker with an authentic Hermes runtime).
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Active 10/10 delivery goal

- Goal adopted on 2026-08-03: raise Efesto one measured gate at a time until the Kernel, agent boundary, user experience, privacy/security, operational readiness, and market proof each have executable acceptance evidence.
- This is a roadmap commitment, not a claim that Efesto is already 10/10. The current increment is implemented and locally verified; the authentic Hermes Agent Hub run, Knowledge Graph projection, general scheduler, visual acceptance, alpha users, and scale proof remain separate gates.

## Next product priority

Execute one explicitly consented Goal mission through the user's installed Hermes CLI and collect sanitized Issue #101 acceptance evidence (authentic Agent Hub worker proof). Do not mark the worker path complete from adapter code or tests alone; the proof must connect a real external Hermes runtime, not a simulation, and must not be conflated with the completed Issue #57 ingestion acceptance.

After authentic runtime proof, continue the broader extension information-architecture and onboarding rebuild around the observable pixel-forge activity contract. The extension remains the primary capture/consent surface; Replay Lab remains advanced forensic mode; the Control Center dashboard is a secondary authenticated local client. Preserve local-first ownership and do not introduce central collection until a separate consent, minimization, and anonymization design is reviewed.

The Kernel memory-quarantine and toxic-memory lifecycle design remains a bounded backlog item under Issue #98 / PR #125. It must not displace the current Efesto product priority or introduce automatic enforcement before explicit review.

## External acceptance status

Real Hermes capture acceptance for Issue #57 is complete. Future screenshots and public product evidence should use the sanitized authentic Replay Lab investigation or another sanitized real run. Generated mockups and synthetic fixtures remain unsuitable as external acceptance evidence.

A separate authentic runtime proof is still required for the Agent Hub external-adapter worker path (Issue #101). The adapter from PR #103 exists, but the live external Hermes connection is not yet proven through a real run. The earlier Replay Lab acceptance (Issue #57) covers ingestion only and must not be presented as worker proof.

## Recovery prompt

Copy this into a new chat if continuity is lost:

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix APO or any other project. First read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve all existing security and Kernel-authority invariants. Continue exactly one bounded task from the recorded next priority, with tests and evidence before review or merge.
```

## Update rule

Every merged phase that changes the completed baseline, active blocker, next priority, validation totals, or recovery procedure must update this file in the same PR. Do not append an endless diary here; replace stale operational facts with the newest verified state.
