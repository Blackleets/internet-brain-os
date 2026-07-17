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

## Memory Architecture

Memory lifecycle supports:

- reinforce
- decay
- invalidate
- restore

Memory changes are recorded through an append-only event log. Duplicate normalized memories can be consolidated conservatively. Consolidation preserves source memory IDs and evidence IDs through provenance records.

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
