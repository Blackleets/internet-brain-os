# Internet Brain OS — Architecture Continuation Guide

## Purpose

This document is the canonical handoff point for any future agent continuing the repository. Read it before modifying code.

## Product Identity

- **Project:** Internet Brain OS
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

Memory records now carry an explicit lifecycle status. Active memories can be updated or reinforced; archival is the deletion-equivalent lifecycle transition and hides records from default reads while preserving history for provenance-aware recovery. Consolidation is conservative across matching kind, subject, and normalized content, and provenance records include origin, source memory IDs, related Case IDs, Evidence IDs, parent provenance IDs, and timestamp.

The shared and kernel packages publish runtime-compatible CommonJS artifacts from their `dist/index.js` entrypoints. The kernel root entrypoint delegates to `public-api`, which is the canonical runtime and declaration barrel for downstream packages.

Workspace package contract decisions:

- `@internet-brain-os/kernel` is the downstream-agent runtime package and must keep both `main` and `types` aligned with generated artifacts.
- `@internet-brain-os/shared` remains private for now but publishes a stable local runtime/types entrypoint because every kernel/downstream package depends on its domain contracts.
- `@internet-brain-os/obsidian` remains private and declaration-only: it is an internal export adapter, not a downstream-agent runtime package yet. It intentionally has no `main`/`types` package entrypoint while private.
- `@internet-brain-os/connectors` remains private and declaration-only: it is an internal ingestion/security adapter set, not a public runtime package yet. It intentionally has no `main`/`types` package entrypoint while private.
- `@internet-brain-os/skills` remains private: skills can be consumed inside the workspace, but should not become public until the skill manifest/runtime loading contract is stable.
- `@internet-brain-os/agents` remains private: the current package is only a placeholder surface and should not expose downstream runtime contracts yet.

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

### Phase 1 local capture path

The extension popup lets the user start a new Case or select an active local Case. First-time credential delivery uses a Chrome-extension-origin-only pairing endpoint with an eight-character one-use code, five-minute expiry, and five-attempt lockout; the persistent token is never printed. Successful pairing persists the exact Chrome extension ID with owner-only permissions. Every extension API call requires both the token and an allowlisted origin; token rotation clears the identity registry so incident recovery requires fresh pairing. Empty identity registries reject extension-origin API calls by default, preventing stolen token reuse before explicit authorization. The paired extension sends authenticated `hephaestus.page-context.v1` payloads with an optional target Case to the local HTTP receiver. The receiver is loopback-only, validates the `Host`, origin, persistent private API token, extension identity, content type, payload size, and schema, then durably journals accepted captures before returning a deterministic receipt. Generated credentials are stored with owner-only permissions and rotate only under explicit user control. Persisted POSIX token and identity files must already have owner-only permissions when loaded; Windows keeps functional compatibility without relying on POSIX mode bits. A capture projector creates or attaches Evidence in the existing local knowledge store. When `HEPHAESTUS_OLLAMA_MODEL` is configured, an optional loopback-only Ollama adapter adds a structured summary, explicitly uncertain hypotheses, limitations, and model provenance without replacing raw Evidence. Missing, unavailable, timed-out, or invalid model output leaves the deterministic capture path intact. Obsidian-compatible Case, Evidence, and evidence-report notes are atomically refreshed, with captured/model text rendered inert to prevent active Markdown injection. Public web connectors validate address scope and pin the validated IP into the connection while retaining the original hostname for TLS, closing DNS rebinding between validation and use. The receipt is preserved as correlation provenance, and retries or restarts cannot duplicate the projection.

### P0 — Stabilize the foundation

- [x] Add initial coverage for research lifecycle, retries, and failure telemetry.
- [x] Add/repair tests for memory lifecycle, consolidation, provenance, and Hermes orchestration.
- [x] Run the repository's typecheck/test/build commands and fix regressions.
- [x] Ensure all public exports match actual implementations.

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
- Add a local status/setup surface that explains Kernel, Ollama, and Obsidian readiness without requiring cloud services.

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
