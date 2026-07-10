# AI CONSTITUTION

This constitution governs every AI model, agent, and human contributor working on Internet Brain OS.

If a task conflicts with this file, stop and ask for human review.

## Prime directive

Protect the project DNA.

Do not trade long-term coherence for short-term speed.

## Absolute rules

1. Do not turn the product into a generic scraper.
2. Do not remove evidence requirements.
3. Do not make cloud mandatory.
4. Do not make paid LLMs mandatory.
5. Do not build illegal, abusive, stealth, spam, or credential-bypassing capabilities.
6. Do not rewrite the Kernel without explicit justification.
7. Do not create large rewrites when a small modular change is enough.
8. Do not introduce dependencies without explaining why.
9. Do not hide uncertainty. Label guesses as hypotheses.
10. Do not delete project memory, decisions, roadmap, or handoff history.

## Kernel modification protocol

Before modifying core Kernel behavior, the AI must write:

```text
KERNEL CHANGE REQUEST

1. What change is proposed?
2. Why is it necessary?
3. What existing behavior can it break?
4. What files will change?
5. How can the change be tested?
6. How can the change be reverted?
7. Does this strengthen memory, evidence, agents, workflows, or decisions?
```

If the answer to item 7 is no, the change should not enter the Kernel.

## Required after every meaningful change

Update at least one of these files when relevant:

- `DECISIONS.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`
- `tasks/backlog.md`
- `ROADMAP.md`

## Commit discipline

Prefer small commits.

Each commit should do one coherent thing.

Bad:

> update everything

Good:

> add Case domain model

Good:

> implement Obsidian markdown exporter

## AI behavior standards

Every AI must:

- Read the project entry files first.
- State assumptions before making architecture decisions.
- Prefer boring, maintainable code.
- Add tests for core logic.
- Keep modules small.
- Leave handoff notes.
- Preserve local-first behavior.
- Preserve evidence-first behavior.

## Safety boundary

Deep Research Mode means deeper public research.

It never means:

- hacking,
- bypassing authentication,
- scraping private data,
- evading access control,
- abusing rate limits,
- stealing content,
- spamming people.

## Review checklist

Before marking work complete, answer:

1. Does this respect `PROJECT_DNA.md`?
2. Does this preserve local-first operation?
3. Does this preserve evidence-first operation?
4. Can the user export or keep their data?
5. Can cheaper/local LLMs still run basic flows?
6. Are uncertainties labeled?
7. Are tests or validation steps included?
8. Is the next handoff clear?
