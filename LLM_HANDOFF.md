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
- Unit tests: 29/29 pass
- Build: passes

### Risks
- Evidence content references assume external storage.
- LLMRequest/LLMResponse are minimal and may need extension for provider-specific features handled in adapters.
- Validation functions throw RangeError for invalid inputs, which must be caught by callers.

## Handoff 2026-07-20 - GPT-5.5 Thinking

### What I changed
- Completed the Hermes ingestion hardening sequence through storage-backed local server wiring.
- Merged PR #52 after CI passed, enabling optional `/hermes/ingestions` in the real local Kernel server when `IBOS_HERMES_SECRET` or `HEPHAESTUS_HERMES_SECRET` is configured.
- Added a reproducible Hermes smoke test script that starts the local Kernel, checks `/health`, sends a signed Hermes sample payload, retries the same idempotency key, and verifies replay returns the same cognitive record id.
- Documented the signed Hermes → Internet Brain OS ingestion contract, including endpoint, headers, HMAC signing string, event rules, idempotency behavior, authority boundary, smoke test, and failure signals.
- Updated README and Hermes operating protocol so future contributors read the ingestion contract and run `pnpm hermes:smoke` after ingestion-related changes.
- Updated CHANGELOG with the local Hermes ingestion route and smoke contract work.

### Files changed
- `scripts/hermes-smoke-test.mjs`
- `docs/hermes-ingestion-contract.md`
- `package.json`
- `README.md`
- `docs/hermes-operating-protocol.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The system needed a reproducible test path for real Hermes ingestion after the authenticated local boundary and server route were built.
- The contract needed to be explicit so Hermes can emit accepted events without inventing Kernel authority fields.
- The smoke path protects against regressions in local server wiring, HMAC signing, idempotent replay, and Kernel cognitive record creation.

### Tests or checks performed
- PR #52 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- PR #53 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- The new `pnpm hermes:smoke` script is designed to be run after `pnpm build` because the local Kernel imports the built Kernel package.

### Risks / uncertainties
- I did not execute the smoke test inside this chat runtime; it requires the repo checkout plus dependencies/build artifacts in a local or CI runner.
- The current sample payload is synthetic. The next validation step must run an actual Hermes Agent output through the same signed path.
- The local server route intentionally remains disabled unless a Hermes secret is configured.

### Next recommended step
- Validate PR for `phase/2.9-hermes-agent-output-adapter`.
- Then add a CLI path that reads a real Hermes Agent run export JSON, converts it through `HermesAgentOutputAdapter`, signs it, and submits it to `/hermes/ingestions`.

### Do not forget
- Never allow Hermes to submit `validation`, `contradiction`, `admission`, `claim`, `candidate`, or `durableClaim`.
- For ingestion-related changes, run `pnpm build` and then `pnpm hermes:smoke`.
- The smoke script validates replay/idempotency but not yet a live Hermes provider output.

## Handoff 2026-07-20 - GPT-5.5 Thinking - Hermes Agent Adapter

### What I changed
- Added `HermesAgentOutputAdapter` to convert bounded Hermes Agent run exports into Kernel `HermesExecutionEvent[]`.
- Added authority-field rejection for embedded Kernel-owned fields such as `validation`, `contradiction`, `admission`, `candidate`, `durableClaim`, and `knowledgeAdmission`.
- Added tests for valid conversion, authority-field rejection, and claim references to unknown evidence.
- Updated the ingestion contract to document the bounded real-agent export shape.
- Updated CHANGELOG with the adapter work.

### Files changed
- `packages/kernel/src/orchestration/hermes-agent-output-adapter.ts`
- `packages/kernel/src/orchestration/index.ts`
- `packages/kernel/test/hermes-agent-output-adapter.test.ts`
- `docs/hermes-ingestion-contract.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The project needed a bridge between real Hermes Agent output and the already-secured IBOS ingestion event contract.
- The bridge must remain provider-neutral and must not let Hermes manufacture Kernel authority decisions.

### Tests or checks performed
- PR validation pending for `phase/2.9-hermes-agent-output-adapter`.

### Risks / uncertainties
- The adapter expects an explicit bounded export shape. If the real Hermes Agent emits a different native structure, a thin extractor should map native logs/traces into this shape before using the adapter.
- A CLI that reads the bounded export and submits it through signed ingestion is still the next useful layer.

### Next recommended step
- Open PR for `phase/2.9-hermes-agent-output-adapter` and wait for CI.
- Then implement `scripts/hermes-ingest-agent-output.mjs` to read a real export file, adapt it, sign it, and POST it to the local Kernel.

### Do not forget
- The adapter only normalizes operational output. Kernel validation, contradiction, admission, storage, idempotency, and recovery remain Kernel-owned.