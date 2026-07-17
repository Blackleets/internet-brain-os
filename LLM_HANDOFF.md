# LLM HANDOFF

This file lets Hermes, OpenCode, Codex, GPT, and future models continue work without losing logic.

Every AI must update this file before ending a work session.

## Current project state

Status: Foundation runtime is being stabilized.

Current phase: Phase 0 foundation hardening / orchestration runtime.

Primary objective: Build the minimum local-first Kernel with Case, Evidence, Memory, Obsidian export, basic report generation, and a robust Hermes ↔ Hephaestus research runtime.

## Mandatory reading order

Before doing work, read:

1. `README.md`
2. `PROJECT_DNA.md`
3. `PROJECT_BIBLE.md`
4. `AI_CONSTITUTION.md`
5. `LLM_HANDOFF.md`
6. `ARCHITECTURE.md`
7. `AGENTS.md`
8. `ROADMAP.md`
9. `tasks/phase-0.md`
10. `DECISIONS.md`

## Handoff template

Every AI must append a new handoff entry using this format:

```markdown
## Handoff YYYY-MM-DD - Model/Agent Name

### What I changed
- ...

### Files changed
- ...

### Why I changed it
- ...

### Tests or checks performed
- ...

### Risks / uncertainties
- ...

### Next recommended step
- ...

### Do not forget
- ...
```

## Model usage strategy

### Hermes
Role: project orchestrator and technical director.

Best for:
- Reading the repo.
- Creating task plans.
- Coordinating agents.
- Maintaining roadmap/backlog.
- Checking that work follows the Constitution.

Avoid:
- Big architecture changes without explicit review.
- Silent rewrites.

### OpenCode
Role: free/low-cost implementation worker.

Best for:
- Creating files.
- Implementing small modules.
- Writing tests.
- Running local tasks.
- Prototyping.

Avoid:
- Changing project identity.
- Rewriting the Kernel alone.
- Adding complex dependencies without justification.

### Codex
Role: code specialist.

Best for:
- Implementing features.
- Debugging.
- Refactoring.
- Writing tests.
- Reviewing diffs.

Avoid:
- Product pivots.
- Unsupported architecture decisions.

### Strong GPT/Claude/Gemini-class models
Role: high-level architect, reviewer, and reasoning engine.

Best for:
- Architecture review.
- Security review.
- Data model review.
- Complex reasoning.
- Deep synthesis.

Avoid:
- Spending expensive credits on simple boilerplate.

### Ollama/local small models
Role: cheap local execution.

Best for:
- Summaries.
- Classification.
- Note generation.
- Extraction cleanup.
- Basic tagging.

Avoid:
- Unreviewed architecture decisions.

## Human workflow

Recommended cycle:
1. Human asks Hermes/OpenCode to implement one small task from the active priority queue.
2. The AI changes the repo.
3. The AI updates `LLM_HANDOFF.md` and `ARCHITECTURE.md` if needed.
4. Human asks a reviewer to inspect the diff.
5. If approved, continue to the next task.

## Review command for future models

Use this prompt when passing the repo to a new AI:

```text
You are working on Internet Brain OS.

Before making changes, read README.md, PROJECT_DNA.md, PROJECT_BIBLE.md, AI_CONSTITUTION.md, LLM_HANDOFF.md, ARCHITECTURE.md, AGENTS.md, ROADMAP.md, DECISIONS.md, and the active task file.

Your job is to continue the project without breaking its identity.

Work on only one bounded task at a time.

Before changing the Kernel, inspect the current implementation, tests, exports, and file SHA.

After finishing, update LLM_HANDOFF.md and any relevant architecture, decision, or backlog files.

Do not remove evidence-first, local-first, Obsidian-compatible, or free-first principles.
```

## Initial handoff

The project is being prepared as a repository that multiple LLMs can work on safely.

The repository now contains a technical foundation, shared domain types, evidence management, memory lifecycle primitives, and an explicit research orchestration runtime.

## Handoff 2026-07-11 - Hermes

### What I changed
- Created monorepo structure with package.json, pnpm-workspace.yaml, tsconfig.json
- Created apps/ and packages/ directory structure with placeholder READMEs
- Created packages/kernel/, packages/obsidian/, packages/shared/, packages/skills/, packages/agents/ with package.json and tsconfig.json
- Created prompts/ directory with README.md
- Fixed TypeScript project references: removed "noEmit": true from tsconfig.base.json, set up root tsconfig.json with references, and configured each package tsconfig.json with composite: true and necessary compiler options
- Added placeholder source files (src/index.ts with export {}) in each package
- Updated package.json with correct scripts and packageManager version
- Updated .gitignore to ignore tsconfig.tsbuildinfo
- Updated CHANGELOG.md, LLM_HANDOFF.md, brain/BRAIN_LOG.md, and created knowledge/agent-sessions/2026-07-11-hermes-phase-0-1-technical-skeleton.md

### Files changed
- package.json
- pnpm-workspace.yaml
- tsconfig.json
- tsconfig.base.json
- packages/*/package.json (for kernel, obsidian, shared, skills, agents)
- packages/*/tsconfig.json (for kernel, obsidian, shared, skills, agents)
- packages/*/src/index.ts (new)
- apps/extension/package.json
- apps/extension/README.md
- apps/dashboard/package.json
- apps/dashboard/README.md
- prompts/README.md
- .gitignore
- vitest.config.ts
- CHANGELOG.md
- LLM_HANDOFF.md
- brain/BRAIN_LOG.md
- knowledge/agent-sessions/2026-07-11-hermes-phase-0-1-technical-skeleton.md

### Why I changed it
To satisfy the requirements of GitHub Issue #1: Phase 0.1 — Create the minimum technical skeleton for the Internet Brain OS monorepo.

### Tests or checks performed
- pnpm install: succeeded (with warning about packageManager version format, non-blocking)
- pnpm typecheck: succeeded (exit code 0)
- pnpm test: succeeded (exit code 0, no test files found, but passWithNoTests configured)
- pnpm build: succeeded (exit code 0)
- git status: clean after committing

### Risks / uncertainties
- Vite CJS deprecation warning is non-blocking.
- Apps are placeholders only.
- No production tests or business logic exist yet.
- Phase 0.1 is structural only.

### Next recommended step
- Strategic review and merge decision for PR #2.
- Phase 0.2 must not start before PR #2 is merged.

### Do not forget
- Update CHANGELOG.md with the entry for 2026-07-11.
- Update brain/BRAIN_LOG.md with session notes.
- Create the Obsidian session note at knowledge/agent-sessions/2026-07-11-hermes-phase-0-1-technical-skeleton.md.

## Phase 0.2: Shared Domain Types (Completed)

### Work Completed
- Defined shared domain types in `packages/shared/src`.
- Added branded IDs, verification status, confidence, timestamps, evidence, entity, relationship, report, skill, LLM, and validation contracts.
- Moved tests to `packages/shared/test/validation.test.ts`.
- All types are provider-agnostic, use readonly where appropriate, and avoid framework dependencies.
- Validation enforces canonical UTC ISO-8601 timestamps and rejects invalid confidence values.

### Validation
- TypeScript typecheck: passes
- Unit tests: 29/29 pass
- Build: passes

### Risks
- Evidence content references assume external storage.
- LLMRequest/LLMResponse are minimal and may need extension for provider-specific features handled in adapters.
- Validation functions throw RangeError for invalid inputs, which must be caught by callers.

## Handoff 2026-07-12 - Codex strategic review

### What I changed
- Reviewed and completed Phase 0.4 Evidence Manager in PR #7.
- Added explicit Case attach/detach operations.
- Added focused tests for Entity, Relationship, and Case link lifecycles.
- Removed the unused immutable-field runtime error; immutability remains enforced structurally by the public update contract.
- Completed institutional-memory synchronization.

### Files changed
- `packages/kernel/src/evidence/evidence-manager.ts`
- `packages/kernel/src/evidence/evidence-errors.ts`
- `packages/kernel/src/evidence/index.ts`
- `packages/kernel/test/evidence-public-api.test.ts`
- `packages/kernel/test/evidence-links.test.ts`
- `LLM_HANDOFF.md`
- `brain/BRAIN_LOG.md`
- `knowledge/agent-sessions/2026-07-12-chatgpt-phase-0-4-evidence-manager.md`

### Why I changed it
To close the review gaps in Issue #6 before integration and ensure the Evidence Manager exposes every required link operation with executable coverage.

### Tests or checks performed
- Added deterministic unit coverage for link/unlink and attach/detach behavior.
- GitHub Actions must run on the new commits before merge.
- Existing PR validation previously passed install, typecheck, test, and build.

### Risks / uncertainties
- Storage adapters must later implement atomic compare-and-update semantics to protect concurrent writes.
- Hash validation confirms SHA-256 syntax, not correspondence with unavailable content bytes.

### Next recommended step
- Confirm CI on PR #7.
- Merge PR #7 only if all required checks pass.
- Create the next bounded Phase 0 task from `tasks/phase-0.md`; do not jump to the browser extension.

### Do not forget
- GitHub remains canonical.
- Phase 0 is incomplete until local persistence, ingestion, Obsidian export, report generation, and a minimal runner exist.

## Handoff 2026-07-17 - GPT 5.5 / Hephaestus Runtime Hardening

### What I changed
- Added the Hermes + Hephaestus architecture continuation guide.
- Added the agent continuation contract.
- Added append-only memory lifecycle event logging.
- Added conservative memory consolidation with canonical-memory selection.
- Added memory provenance merging that preserves source memory IDs and evidence IDs.
- Added an explicit research state machine.
- Added append-only research transition history and resumable checkpoints.
- Added executable research stages with structured results.
- Added bounded retry policy and failure telemetry.
- Integrated retries and failure telemetry into `ResearchExecutionRuntime`.
- Added `HermesHephaestusOrchestrator` to adapt Hermes tools into Hephaestus research stages.
- Added initial runtime tests covering full lifecycle execution, retries, failure transitions, and typed retry errors.
- Updated the architecture continuation guide and active handoff instructions so future agents can continue from the current state safely.

### Files changed
- `ARCHITECTURE.md`
- `AGENTS.md`
- `LLM_HANDOFF.md`
- `packages/kernel/src/memory/memory-event-log.ts`
- `packages/kernel/src/memory/memory-consolidation.ts`
- `packages/kernel/src/memory/memory-provenance.ts`
- `packages/kernel/src/memory/index.ts`
- `packages/kernel/src/orchestration/research-state-machine.ts`
- `packages/kernel/src/orchestration/research-state-machine-history.ts`
- `packages/kernel/src/orchestration/research-execution.ts`
- `packages/kernel/src/orchestration/research-retry-policy.ts`
- `packages/kernel/src/orchestration/hermes-hephaestus-orchestrator.ts`
- `packages/kernel/src/orchestration/index.ts`
- `packages/kernel/test/research-runtime.test.ts`

### Why I changed it
To move the project from a collection of domain primitives toward a recoverable, observable research execution runtime while preserving the separation between Hermes (external execution) and Hephaestus (knowledge forging).

### Tests or checks performed
- Added deterministic Vitest coverage for the new research runtime and retry policy.
- The repository's full typecheck/test/build commands still need to be run against the latest commit before claiming the foundation is fully validated.

### Risks / uncertainties
- The current Hermes orchestrator selects the first available tool; deterministic multi-provider fallback is still a P1 task.
- Checkpoints are currently in-memory; durable persistence is still a P2 task.
- Runtime tests were added but CI/local validation of the latest combined state remains outstanding.

### Next recommended step
- Run typecheck, tests, and build on the latest repository state.
- Fix any compile or behavioral regressions before adding more architecture.
- Then add memory lifecycle/consolidation/provenance tests and strengthen Hermes multi-provider fallback.

### Do not forget
- Read `ARCHITECTURE.md` and `AGENTS.md` before continuing.
- Do not add Nametrom model-specific logic to the kernel.
- Preserve evidence, provenance, and history.
- Make one bounded change at a time.
