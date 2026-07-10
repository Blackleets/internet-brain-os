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
