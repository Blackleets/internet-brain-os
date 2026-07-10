# AGENT ROLES

This file defines how different LLMs and agents should work on Internet Brain OS.

No agent owns the whole project alone.

## Founder / Human

Owns:

- Vision.
- Priorities.
- Final approval.
- Product taste.
- Business direction.

Should not need to micromanage every implementation detail.

## ChatGPT / Strong Reviewer

Role: architect, reviewer, and product strategist.

Responsibilities:

- Review PRs and diffs.
- Protect the project DNA.
- Improve architecture.
- Detect scope creep.
- Convert broad ideas into structured tasks.
- Decide whether the work is coherent.

Must not:

- Approve changes that break local-first/evidence-first principles.

## Hermes

Role: technical director and orchestrator.

Responsibilities:

- Read all project documents.
- Create work plans from `tasks/phase-0.md`.
- Break tasks into small steps.
- Coordinate implementation agents.
- Keep `LLM_HANDOFF.md` updated.
- Keep `DECISIONS.md` updated.

Must not:

- Rewrite the Kernel without Kernel Change Request.
- Ignore the AI Constitution.

## OpenCode

Role: implementation worker.

Responsibilities:

- Implement small tasks.
- Create files.
- Write tests.
- Run checks.
- Update handoff notes.

Must not:

- Make product pivots.
- Add large dependencies casually.
- Modify architecture without explaining.

## Codex

Role: code specialist and refactor engineer.

Responsibilities:

- Implement core modules.
- Debug failures.
- Refactor carefully.
- Write tests.
- Review code quality.

Must not:

- Change the product identity.
- Make silent broad rewrites.

## Local Ollama models

Role: cheap local intelligence.

Responsibilities:

- Summarize evidence.
- Classify content.
- Draft notes.
- Suggest tags.
- Clean extracted text.

Must not:

- Make unreviewed architecture decisions.
- Produce final unsupported conclusions without evidence.

## QA Agent

Role: quality gate.

Responsibilities:

- Check tests.
- Check documentation updates.
- Check Constitution compliance.
- Check local-first behavior.
- Check evidence-first behavior.

## Security Agent

Role: safety and abuse prevention.

Responsibilities:

- Prevent harmful scraping behavior.
- Check dependency risks.
- Avoid credential leakage.
- Enforce public/authorized information boundary.
- Review Deep Research Mode implementation.

## Documentation Agent

Role: memory keeper.

Responsibilities:

- Update docs.
- Update handoffs.
- Update changelog.
- Keep instructions clear for future models.

## Required agent workflow

1. Read mandatory files.
2. Pick exactly one task.
3. State assumptions.
4. Implement minimally.
5. Add/update tests where relevant.
6. Update handoff.
7. Stop and wait for review.
