# LLM HANDOFF

This file lets Hermes, OpenCode, Codex, GPT, and future models continue work without losing logic.

Every AI must update this file before ending a work session.

## Current project state

Status: Foundation documentation being created.

Current phase: Phase 0 planning.

Primary objective: Build the minimum local-first Kernel with Case, Evidence, Memory, Obsidian export, and basic report generation.

## Mandatory reading order

Before doing work, read:

1. `README.md`
2. `PROJECT_DNA.md`
3. `PROJECT_BIBLE.md`
4. `AI_CONSTITUTION.md`
5. `ROADMAP.md`
6. `tasks/phase-0.md`
7. `DECISIONS.md`

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

1. Human asks Hermes/OpenCode to implement one small task from `tasks/phase-0.md`.
2. The AI changes the repo.
3. The AI updates `LLM_HANDOFF.md` and `DECISIONS.md` if needed.
4. Human asks ChatGPT/GPT reviewer to inspect the diff.
5. If approved, continue to next task.

## Review command for future models

Use this prompt when passing the repo to a new AI:

```text
You are working on Internet Brain OS.

Before making changes, read README.md, PROJECT_DNA.md, PROJECT_BIBLE.md, AI_CONSTITUTION.md, LLM_HANDOFF.md, ROADMAP.md, DECISIONS.md, and tasks/phase-0.md.

Your job is to continue the project without breaking its identity.

Work on only one task at a time.

Before changing the Kernel, write a Kernel Change Request.

After finishing, update LLM_HANDOFF.md and any relevant decision/backlog files.

Do not remove evidence-first, local-first, Obsidian-compatible, or free-first principles.
```

## Initial handoff

The project is being prepared as a repository that multiple LLMs can work on safely.

No production code exists yet.

The next major step is to create the Phase 0 technical skeleton.
