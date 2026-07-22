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
- Shell-free Hermes mission worker for an explicitly configured external adapter, with bounded JSON stdin/stdout, failure reporting, and observable Agent Hub mission states in the extension. No Hermes executable is bundled; authentic runtime proof still requires the user's configured Hermes instance.
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
- Local API tokens reject whitespace/control characters; persisted POSIX token files fail closed when group or world permissions are present, and rotation remains explicit.
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
- Issue #10: Internal Orchestrator v0 closed as completed with PR #73–#77 evidence.
- Issue #57: real Hermes runtime acceptance completed with a sanitized authentic local Hermes session; signed ingestion, exact replay, altered-replay conflict rejection, authority-field rejection, and Replay Lab visibility were proven without persisting raw prompts, responses, tool output, credentials, tokens, or secrets.
- Local validation baseline: 74 test files / 367 tests plus typecheck and build, including the Safe Action Workspace, explainable Opportunity Command Center, persistent local Mission Watchtower and result center, bounded visible-popup Agent Hub live refresh, persisted investigating/verifying/forged mission phases, extension workspace navigation, state-derived onboarding, honest newest-mission progress and persisted Mission Forge Ledger activity, evidence-first unverified Find details, automatic-capture privacy policy, authenticated capture import, private Goal validation/personalization and dismissal, explicit erasable preference learning, consented Agent Hub mission execution/result transport, duplicate-accurate Evidence accounting, private IPv4/IPv6 result rejection, shell-free external-adapter worker, observable mission and pixel-forge activity states, authenticated Model Forge inspection, extensible deterministic Opportunity classification/inbox, signed ingestion, exact replay, altered-replay rejection, Replay Lab API, and fail-closed local token-file handling. CI must confirm the updated total before merge.

## Current operating state

- `main` is the sole source of truth and includes the Efesto extension product surface, Opportunity and Goal workflows, Agent Hub transport, Model Forge, pixel-forge activity, deterministic forensic read path, real-capture importer, and local token-file hardening.
- PR #103 is the sole active implementation task: add the bundled authentic Hermes one-shot adapter and its focused tests.
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Next product priority

Complete PR #103, then execute one explicitly consented Goal mission through the user's installed Hermes CLI and collect sanitized Issue #101 acceptance evidence. Do not mark the worker path complete from tests alone.

After authentic runtime proof, continue the broader extension information-architecture and onboarding rebuild around the observable pixel-forge activity contract. The extension is the primary surface; Replay Lab remains advanced mode. Preserve local-first ownership and do not introduce central collection until a separate consent, minimization, and anonymization design is reviewed.

The Kernel memory-quarantine and toxic-memory lifecycle design remains a bounded backlog item under Issue #98. It must not displace the current Efesto product priority or introduce automatic enforcement before explicit review.

## External acceptance status

Real Hermes capture acceptance for Issue #57 is complete. Future screenshots and public product evidence should use the sanitized authentic Replay Lab investigation or another sanitized real run. Generated mockups and synthetic fixtures remain unsuitable as external acceptance evidence.

A separate authentic runtime proof is still required for the newer Agent Hub external-adapter worker path. The user's Hermes CLI, Kernel, token, and worker doctor are now locally available; PR #103 supplies the translation adapter. The proof must not be simulated or conflated with the completed Issue #57 ingestion acceptance.

## Recovery prompt

Copy this into a new chat if continuity is lost:

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix APO or any other project. First read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve all existing security and Kernel-authority invariants. Continue exactly one bounded task from the recorded next priority, with tests and evidence before review or merge.
```

## Update rule

Every merged phase that changes the completed baseline, active blocker, next priority, validation totals, or recovery procedure must update this file in the same PR. Do not append an endless diary here; replace stale operational facts with the newest verified state.
