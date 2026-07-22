# Internet Brain OS — Architecture Continuation Guide

## Purpose

This document is the canonical handoff point for any future agent continuing the repository. Read it before modifying code.

## Product Identity

- **Project:** Internet Brain OS
- **Product experience:** Efesto Opportunity Radar.
- **Core architecture:** Hermes + Hephaestus
- **Hermes:** external discovery, tools, transport, provider interaction, execution.
- **Hephaestus:** evidence, claims, entities, graph, memory, provenance, validation, reasoning foundations.

## Core Principle

> Hermes gathers and moves information. Hephaestus forges, validates, remembers, and reasons over it.

Do not collapse both responsibilities into one layer.

## Current Architecture

```text
Hermes
  ↓
Discovery / Tools / Providers
  ↓
Hermes ↔ Hephaestus Orchestrator
  ↓
Research Execution Runtime
  ↓
Research State Machine
  ↓
Hephaestus Kernel
  ├── Evidence
  ├── Claims
  ├── Entity Resolution
  ├── Knowledge Graph
  ├── Memory
  │   ├── Lifecycle
  │   ├── Event Log
  │   ├── Consolidation
  │   └── Provenance
  └── Validation / Reasoning Foundations
  ↓
Reporting / Actions
  ↓
Hermes
```

## Efesto Browser Experience

The browser extension is the primary product surface. A user explicitly authorizes a public web origin, after which the extension may capture pages from that origin in the background and send them only to that user's loopback Kernel. Authorization is revocable per site. Automatic capture fails closed for account, authentication, payment, wallet, messaging, and settings paths; sensitive query keys and user selections are also excluded. Repeated page captures are bounded by a local cooldown.

The local Kernel remains the privacy boundary and projects accepted Evidence into the user's configured Obsidian-compatible vault. No central telemetry or collective-intelligence upload exists in this phase. Hermes and future agents remain external adapters; Replay Lab is an advanced forensic surface, not the primary onboarding experience.

Accepted public-page Evidence passes through an extensible deterministic Opportunity classifier in the local Kernel. It promotes only sufficiently strong, explainable signals across work, grants, clients, savings, food, public aid, learning, events, housing, travel, collaboration, rewards, and useful tools. A promoted record retains its Case and Evidence identifiers, canonical public source, category, concrete benefit type, bounded relevance score, matching signals, raw deadline text when present, and a cautious next action. Ordinary captures remain Evidence and do not pollute the Opportunity Inbox. The authenticated local Inbox is rendered by the extension and synchronized as separate Opportunity notes into the user's vault. This classifier is a lead filter, not a verification, financial-advice, or recommendation engine; Hermes investigation and human review remain separate stages.

Users may define private Goals with a title, bounded categories and keywords, optional location, and explicit priority. Goals remain in the local Kernel and are synchronized into the user's own Obsidian-compatible vault. Opportunity detection keeps its original evidence relevance score; a separate explainable personalization score links Inbox records to matching Goals and changes ordering without rewriting provenance. Explicit dismissal atomically marks the persisted Opportunity so it leaves the Inbox while retaining its feedback history. Goals never trigger external browsing merely by being created. The extension can request a separately confirmed, idempotent Hermes research mission containing only the Goal's authorized scope. A disconnected adapter leaves that mission visibly waiting; queued status is used only when the real local Hermes boundary is configured. An authenticated local worker boundary now leases queued Hermes missions, accepts at most 20 validated public HTTP(S) findings, rejects sensitive/private IPv4 and IPv6 URLs, preserves returned material as unverified Evidence, re-runs Kernel-owned classification, removes out-of-scope promotions, synchronizes accepted records to the private vault, counts only newly created Evidence in the Forge Ledger, and records bounded failures across at most three observable attempts. This is the transport contract for a real Hermes runtime; it does not fabricate external discovery when no Hermes worker is connected.

The Opportunity Inbox also accepts explicit feedback: useful, saved, dismissed, or not interested. A private Preference Learner converts only those deliberate actions into bounded category, benefit-type, and public-source adjustments. These adjustments are exposed separately from objective Evidence relevance, are idempotent per Opportunity and signal, never trigger external actions, never leave the user's local store, and can be erased through the authenticated local API. Efesto does not infer sensitive traits or silently profile dwell time, private browsing, forms, or messages.

A local mission worker connects the leased transport to an explicitly configured Hermes adapter executable. The adapter is spawned without a shell, receives only the authorized Goal mission as bounded JSON on standard input, and returns at most 20 findings as JSON on standard output. Efesto retains all validation and memory authority. The extension derives honest Agent Hub display states from persisted missions; those states are also the future animation contract for the pixel-forge UI. No Hermes executable is bundled and synthetic worker tests do not satisfy the authentic-runtime acceptance proof.

Efesto bootstrap is a shared local readiness contract, not a second product surface. The Windows launcher, extension, and future Efesto browser shell consume `efesto.bootstrap-status.v1`, which reports Kernel, Hermes, Obsidian, pairing, overall readiness, safe user-facing copy, technical diagnostics, and recoverable actions without exposing tokens or secrets. The launcher may start only the existing one-click Kernel, may clean only launcher-owned stale records, refuses non-Efesto port conflicts, checks Hermes and Obsidian writeability, and leaves daily mission creation to the already-bounded central orb flow.

Model Forge provides an authenticated, local-only inspection surface for Ollama and coarse device capacity. It probes only the configured loopback Ollama API, exposes rounded RAM and CPU-core capacity, distinguishes runtime availability, installed catalog models, and the explicitly configured active model, and recommends only curated bounded model tags that fit the device tier. The extension shows the exact manual pull/configuration step. Model Forge never invokes a package manager, downloads a model, runs a shell, changes the active model, or treats model output as Evidence authority.

The extension's living pixel forge is a presentation of observable state, not an agent or a source of truth. A pure UI contract maps persisted Agent Hub mission states and explicit manual-capture transitions to idle, queued, working, success, or error scenes. The smith animation cannot imply research when no corresponding state exists, and reduced-motion preferences disable its motion without hiding status text.

The extension organizes its primary experience into four presentation-only workspaces: Forge for site consent and capture, Missions for Goals and Hermes research state, Finds for provenance-backed Opportunities and explicit feedback, and Models for guided local Model Forge inspection. The living forge remains visible across these workspaces. Navigation never changes research state or Kernel authority, and the Missions and Finds badges are derived only from authenticated local records.

A state-derived smith guide teaches the first local workflow without tracking behavior or inventing completion: connect the private Kernel, forge a Goal, authorize a public origin, and produce the first provenance-backed Find. Its mission progress uses named stages rather than synthetic percentages and selects the newest mission by persisted creation time. The guide and visual commission/find treatments are presentation only; they cannot authorize research, promote Evidence, or modify stored mission state.

Find details preserve the distinction between objective Evidence relevance and personalized Inbox ordering. Every promoted item remains visibly an unverified lead; the extension may render only retained classifier signals, an explicit Goal match, source/Evidence provenance, deterministic cautions, and the Kernel-provided next action. It must not rename relevance as confidence or imply that Efesto verified the offer, deadline, eligibility, or source safety.

The Missions workspace projects a Forge Ledger from existing authenticated mission records. Cards may display only persisted Goal titles, statuses, bounded attempt counts, creation/claim/failure/completion timestamps, sanitized bounded failure details, and Kernel result summaries. Received findings, created Evidence, and promoted Opportunities remain distinct counts. Mission execution persists a separate additive phase contract: `investigating` when Hermes holds the lease, `verifying` before the local Kernel ingests returned findings, and `forged` only after Evidence, classification, and the result summary are complete. Retry and terminal failures reset that phase explicitly. The UI must not infer missing events or fabricate percentage progress; the smith inspects the piece only while the persisted phase is `verifying`.

While the extension popup is visible, Agent Hub re-reads that authenticated mission record on a bounded state-aware cadence: active investigation/verification refreshes quickly, queued work refreshes less frequently, and idle or terminal state backs off further. Refreshes never overlap, pause while the popup is hidden, tolerate temporary Kernel unavailability without erasing the last observable state, and stop when the popup closes. A newly observed completed mission also refreshes Finds once so Kernel-promoted Opportunities appear without reopening the extension. This is presentation polling only; it does not advance mission state or imply background execution.

When the popup is closed, a local Mission Watchtower uses a one-minute Manifest V3 alarm to read the same authenticated loopback mission list. Its first successful observation is only a baseline, so installation cannot replay historical notifications. It records at most 100 mission revisions and 20 terminal result events in extension-local storage, emits at most one generic desktop notification for a known mission entering `completed` or `failed`, and retains state across service-worker restarts. Notification text excludes Goal titles, sources, findings, and failure details to avoid leaking private context on a locked screen. Opening a notification routes to the Mission Forge Ledger; marking its result-center event read changes presentation state only and never advances, retries, or mutates the mission.

The Finds workspace includes an Opportunity Command Center derived from the authenticated Inbox order already computed by the Kernel. It may identify the first record to inspect and explain that position using only retained Goal matches, objective Evidence relevance, personalized ordering, raw deadline presence, source, and the Kernel-provided next action. It must keep the record labeled as an unverified lead, must not parse raw deadline text into asserted urgency, must not create a hidden confidence score, and cannot open sources, submit forms, spend money, contact people, or otherwise act without the user.

Each Find may also expose a Safe Action Workspace: a bounded category-aware checklist whose completion is stored only in extension-local storage. Checklist state is private human-review progress, not Evidence, Kernel verification, eligibility confirmation, source certification, or permission to act. It never changes Inbox ordering, feedback, mission state, or the permanent unverified-lead label, and retains at most 100 Find records.

## Research Runtime

The research lifecycle is explicitly modeled:

```text
created
  → discovering
  → ingesting
  → analyzing
  → validating
  → memorizing
  → reporting
  → completed
```

Failures transition to `failed`. Retry and checkpoint recovery are supported by the state history layer. The execution runtime now runs stages through bounded retry policy and returns structured failure telemetry.

## Existing Orchestration Components

- `ResearchStateMachine`: validates legal state transitions.
- `InMemoryResearchStateHistory`: append-only transition history and checkpoints.
- `ResearchExecutionRuntime`: executes stages, retries failures, records results, and emits failure telemetry.
- `runResearchStage`: bounded retries and failure telemetry for one stage.
- `HermesHephaestusOrchestrator`: adapts Hermes tools into Hephaestus research stages.

## Internal Development Orchestrator

The repository also contains a separate, human-gated development orchestrator under `.orchestrator/` and `scripts/orchestrator-*`. Its filesystem CLI persists bounded task contracts and review reports, enforces one active task, validates Hermes execution reports against Git evidence, and requires explicit founder approval when a contract declares it. It does not run product research, call model APIs, mutate Git, merge, deploy, or advance autonomously.

## Memory Architecture

Memory lifecycle supports:

- reinforce
- decay
- invalidate
- restore

Memory changes are recorded through an append-only event log. Duplicate normalized memories can be consolidated conservatively. Consolidation preserves source memory IDs and evidence IDs through provenance records.

## Forensic Causality

Replay Lab derives a Causality Map from the persisted cognitive pipeline record. The projection links evidence, claim proposals, validation, contradiction, admission, and durable claims only when those relationships are explicitly present. Every edge is marked as persisted-record evidence; the Kernel does not infer agent intent or hidden causes.

## Local API Token Safety

The local Kernel accepts only 32–512 character tokens made from printable, non-whitespace ASCII. Generated token files are created with owner-only permissions. On POSIX systems, an existing token file with group or world permissions is rejected before its contents are read; the Kernel does not silently repair and trust an exposed credential. Token rotation uses a collision-resistant temporary filename and remains an explicit operator action. Windows keeps functional compatibility without claiming POSIX permission enforcement.

## Continuation Rules

1. Read the relevant package and its tests before editing.
2. Preserve existing public contracts unless a migration is intentional and documented.
3. Never delete provenance, evidence links, or history during consolidation.
4. Prefer additive, typed changes over broad rewrites.
5. Do not introduce provider-specific logic into the Hephaestus domain layer.
6. Hermes adapters should translate external tools into stable internal stage contracts.
7. Every new state transition must be explicit and testable.
8. Every retryable operation must expose bounded attempts and failure information.
9. Do not claim a feature is complete until its implementation, exports, and tests are aligned.
10. Before a large change, inspect current files and SHA/version state to avoid overwriting concurrent work.

## Next Priority Queue

### P0 product path — Opportunity Radar

- [x] Add explicit per-site consent for automatic public-page capture.
- [x] Add privacy blocks for sensitive paths, query keys, selections, and repeated captures.
- [x] Expose honest Kernel, Hermes, Ollama, and Obsidian readiness in the extension.
- [x] Add an opportunity classifier that separates useful findings from ordinary captured Evidence.
- [x] Add a local Opportunity inbox with relevance, source, deadline, and next action.
- [x] Add private Goals that explain and prioritize Inbox matches without changing Evidence relevance.
- [x] Add private, bounded, erasable learning from explicit Opportunity feedback without changing Evidence relevance.
- [ ] Complete Agent Hub adapters without provider coupling in the Kernel: consented missions, leased result transport, a shell-free adapter worker, and observable UI states are implemented; prove the worker with an authentic Hermes runtime, then add OpenClaw against the same contract.
- [x] Add a Model Forge inspection and guided setup flow for compatible local models; never silently install executables or models.
- [ ] Design opt-in anonymized public-signal sharing separately from private user storage.

### Phase 1 local capture path

The extension popup lets the user start a new Case or select an active local Case. First-time credential delivery uses a Chrome-extension-origin-only pairing endpoint with an eight-character one-use code, five-minute expiry, and five-attempt lockout; the persistent token is never printed. Successful pairing persists the exact Chrome extension ID with owner-only permissions. Once at least one identity exists, every extension API call requires both the token and an allowlisted origin; token rotation clears the identity registry so incident recovery requires fresh pairing. Pre-pairing installations remain compatible only while their registry is empty. The paired extension sends authenticated `hephaestus.page-context.v1` payloads with an optional target Case to the local HTTP receiver. The receiver is loopback-only, validates the `Host`, origin, persistent private API token, extension identity, content type, payload size, and schema, then durably journals accepted captures before returning a deterministic receipt. Generated credentials are stored with owner-only permissions and rotate only under explicit user control. A capture projector creates or attaches Evidence in the existing local knowledge store. When `HEPHAESTUS_OLLAMA_MODEL` is configured, an optional loopback-only Ollama adapter adds a structured summary, explicitly uncertain hypotheses, limitations, and model provenance without replacing raw Evidence. Missing, unavailable, timed-out, or invalid model output leaves the deterministic capture path intact. Obsidian-compatible Case, Evidence, and evidence-report notes are atomically refreshed, with captured/model text rendered inert to prevent active Markdown injection. Public web connectors validate address scope and pin the validated IP into the connection while retaining the original hostname for TLS, closing DNS rebinding between validation and use. The receipt is preserved as correlation provenance, and retries or restarts cannot duplicate the projection.

### P0 — Stabilize the foundation

- [x] Add initial coverage for research lifecycle, retries, and failure telemetry.
- [ ] Add/repair tests for memory lifecycle, consolidation, provenance, and Hermes orchestration.
- [ ] Run the repository's typecheck/test/build commands and fix regressions.
- [ ] Ensure all public exports match actual implementations.

### P1 — Make the Hermes bridge production-grade

- Support multiple tools/providers per stage.
- Add deterministic fallback selection.
- Add provider capability metadata.
- Add timeout and cancellation contracts.
- Add structured execution telemetry.
- [x] Project accepted browser inbox records into Case and Evidence through an idempotent adapter.
- [x] Add explicit extension UX for choosing an existing Case instead of starting a new one.
- [x] Connect newly created Evidence to automatic Obsidian export and evidence-report generation.
- [x] Connect Evidence to the summarization Skill contract through an optional loopback-only local Ollama adapter.
- [x] Add a safe local `/status` surface that explains Kernel, Hermes, Replay Lab, Ollama, and Obsidian readiness without requiring cloud services.
- Add the visual setup workflow only after the first authentic Hermes runtime proof establishes the real operator requirements.

### P2 — Make research resumable end-to-end

- Persist checkpoints beyond in-memory storage.
- Resume from the last valid stage.
- Make retries idempotent.
- Add execution/run IDs and correlation IDs.

### P3 — Intelligence layer

- Connect research outputs to evidence, claims, graph, and memory through typed adapters.
- Add confidence/provenance propagation.
- Add contradiction detection before memory reinforcement.

### P4 — Hermes + Nametrom model strategy

The planned direction is a teacher/student or distillation architecture around a larger Nametrom model and a smaller deployment model. Do not hard-code model assumptions into the kernel. Keep model/provider adapters outside the domain core.

## Safe Agent Workflow

```text
READ ARCHITECTURE.md
  ↓
INSPECT TARGET FILES + TESTS
  ↓
CHECK CURRENT SHA
  ↓
MAKE ONE COHERENT CHANGE
  ↓
UPDATE EXPORTS
  ↓
ADD OR UPDATE TESTS
  ↓
TYPECHECK / TEST / BUILD
  ↓
UPDATE THIS GUIDE IF ARCHITECTURE CHANGED
  ↓
CONTINUE TO NEXT PRIORITY
```

## Definition of Done

A task is not done merely because code was written. It is done when:

- the implementation is coherent;
- types and exports are correct;
- tests cover the behavior;
- failure paths are considered;
- provenance and history are preserved;
- the repository remains buildable;
- the next agent can understand where to continue.
Replay Lab projects Causality, AI Autopsy, and Prevention from persisted Kernel-owned records. Autopsy separates observed facts from deterministic interpretation. Prevention outputs are proposals only: they require human approval and cannot mutate policy, admission state, or durable memory.

Replay Lab also provides a local real-capture import boundary. The operator selects JSON or native JSONL, runs a read-only sensitive-data and schema/authority validation, and must separately confirm ingestion. The browser holds only the local API token in tab memory. The Hermes HMAC secret remains server-side, and accepted imports still pass through the existing signed, idempotent ingestion route before appearing as forensic records.
