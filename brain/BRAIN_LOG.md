# Brain Log

This file records important strategic conversations, discoveries, tensions, and ideas that may shape Internet Brain OS.

## Zero Knowledge Loss Rule

Nothing important may exist only in a person's memory, a temporary chat, or an agent session.

When a conversation changes the product vision, architecture, operating model, ethics, or roadmap, it must be converted into repository documentation.

## Required capture process

After every strategic session:

1. Summarize the new insight.
2. Identify whether it is a decision, hypothesis, idea, risk, or task.
3. Update the appropriate document.
4. Link related files.
5. Update `LLM_HANDOFF.md`.
6. Sync the same knowledge into the configured Obsidian vault.

## Current strategic record

### Product evolution

The project began as the idea of improving an AI web scraper.

It evolved into a broader but still focused vision:

- Scraping is an internal capability.
- The product is a local-first web intelligence system.
- The browser extension acts as a contextual copilot.
- The Kernel coordinates Cases, Evidence, Memory, Skills, agents, reports, and exports.
- Obsidian becomes the durable second brain.
- The system should discover opportunities, not merely produce tables.
- Advanced research remains limited to public and authorized information.

### Operating model

The company will use multiple LLMs according to their strengths and cost:

- Hermes as the operational orchestrator.
- OpenCode for inexpensive implementation.
- Codex for code-heavy work and refactoring.
- Strong reasoning models for architecture and review.
- Ollama/local models for cheap classification, summarization, and note generation.

The model is replaceable. The repository, Constitution, Kernel, evidence, and memory are durable.

### Governance

No AI may silently change the vision or Kernel.

Important work follows:

Implementer -> Reviewer -> QA -> Documentation/Knowledge Sync -> Human approval for critical changes.

### Obsidian

Obsidian is not a secondary export feature.

It is the human-readable institutional brain for:

- Decisions.
- Architecture.
- Cases.
- Evidence.
- Agent work logs.
- Pull request summaries.
- Risks.
- Experiments.
- Lessons.

### Company ambition

This is being treated as a serious company and long-term platform, not a disposable experiment.

The project must stay ambitious while executing in small, reversible, tested phases.

## Entry template

```markdown
## YYYY-MM-DD - Topic

### Type
Decision | Idea | Hypothesis | Risk | Lesson | Rejected option

### Context
...

### Insight
...

### Impact
...

### Files updated
- ...

### Next action
- ...
```

## 2026-07-11 - Phase 0.1 Technical Skeleton

### Type
Decision

### Context
Starting Phase 0.1 of Internet Brain OS to create the minimum technical skeleton as per Issue #1.

### Insight
Selected TypeScript, Node.js, pnpm, and Vitest for a local-first, type-safe monorepo with project references. Initial TypeScript configuration failed due to "noEmit": true in base config causing referenced projects to disable emit, leading to TS6310 and TS6306 errors. Fixed by removing "noEmit": true from tsconfig.base.json, setting root tsconfig.json with "noEmit": true and references, and ensuring each package has "composite": true and proper output settings.

### Impact
Established a validated monorepo structure with successful install, typecheck, test, and build. No business logic implemented yet; foundation is ready for Phase 0.2.

### Files updated
- package.json
- pnpm-workspace.yaml
- tsconfig.json
- tsconfig.base.json
- packages/*/package.json (kernel, obsidian, shared, skills, agents)
- packages/*/tsconfig.json (kernel, obsidian, shared, skills, agents)
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

### Next action
- Commit documentation changes, push branch, and open draft PR linked to Issue #1.

## 2026-07-11 | Phase 0.2: Shared Domain Types
**Insight**: Defined the core domain model for the Internet Brain OS, establishing shared types for Case, Evidence, Entity, Relationship, Report, Skill, and LLM interactions. This provides a foundation for the Kernel and Case Manager in Phase 0.3.
**Impact**: Enables type-safe communication between services and ensures a consistent data model across the system.
**Files Changed**:
- packages/shared/src/common.ts
- packages/shared/src/case.ts
- packages/shared/src/evidence.ts
- packages_shared/src/entity.ts
- packages_shared/src/relationship.ts
- packages_shared/src/report.ts
- packages_shared/src/skill.ts
- packages_shared/src/llm.ts
- packages_shared/src/validation.ts
- packages_shared/src/index.ts
- packages_shared/test/validation.test.ts
**Next Step**: Await review of PR #3. If approved, proceed to Phase 0.3 after merge.

## 2026-07-11 - Phase 0.3 Case Manager

### Type
Decision

### Context
The first executable Kernel capability was needed after the shared domain contracts were merged.

### Insight
Case lifecycle logic belongs in a deterministic Kernel service, while persistence remains behind a small `CaseRepository` port. Archived Cases are terminal, timestamps are caller-supplied, and normalization is explicit and testable.

### Impact
Internet Brain OS can now create, retrieve, list, update, transition, and logically archive Cases without coupling business rules to a database or UI. This establishes the pattern for future Kernel managers.

### Files updated
- packages/kernel/src/case/*
- packages/kernel/src/index.ts
- packages/kernel/test/*
- packages/kernel/tsconfig.json
- vitest.config.ts
- .github/workflows/ci.yml
- CHANGELOG.md
- LLM_HANDOFF.md
- brain/BRAIN_LOG.md
- knowledge/agent-sessions/2026-07-11-chatgpt-phase-0-3-case-manager.md

### Next action
- Review the draft PR, inspect CI, correct any failures, and merge only after approval. Phase 0.4 remains unstarted.
