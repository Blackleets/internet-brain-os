# Obsidian Sync Protocol

This protocol is mandatory for Hermes and every integrated AI agent.

GitHub stores versioned software and operating doctrine.
Obsidian stores the human-readable institutional brain.
Neither replaces the other.

## Zero Knowledge Loss

Every meaningful work session must produce a Knowledge Sync before completion.

A task is not complete until its knowledge has been captured.

## What must be synchronized

When relevant, sync:

- Work session summary.
- Decisions and alternatives.
- Architecture changes.
- New concepts and entities.
- Risks and unresolved questions.
- Failed experiments and lessons.
- Pull request summary.
- Test results.
- Next recommended action.

Do not copy secrets, credentials, tokens, or sensitive private data into notes.

## Proposed vault structure

```text
Internet Brain OS/
  Company/
    Founder Vision.md
    Project DNA.md
    AI Constitution.md
    Roadmap.md
  Engineering/
    Architecture/
    Decisions/
    Components/
    ADRs/
  Operations/
    Agent Sessions/
    Pull Requests/
    Incidents/
    Reviews/
  Product/
    Ideas/
    WOW Features/
    UX/
    Skills/
  Cases/
  Entities/
  Evidence/
  Reports/
```

## Agent session note

Every Hermes/OpenCode/Codex work session should create or update:

```text
Operations/Agent Sessions/YYYY-MM-DD - <agent> - <task>.md
```

Template:

```markdown
---
type: agent-session
agent: Hermes
model: <model-name>
date: YYYY-MM-DD
task_id: <task-or-issue>
status: completed|partial|blocked
commits: []
pr: null
---

# Session summary

## Objective

## Work completed

## Files changed

## Decisions

## Tests and validation

## Risks

## Open questions

## Next step
```

## Pull request note

Every non-trivial pull request should create:

```text
Operations/Pull Requests/PR-<number> - <title>.md
```

It must contain:

- Purpose.
- Scope.
- Architecture impact.
- Tests.
- Risks.
- Review result.
- Final merge decision.
- Related decisions and task links.

## Decision notes

Important technical decisions should be recorded as ADR-style notes:

```text
Engineering/Decisions/ADR-XXXX - Title.md
```

Required sections:

- Status.
- Context.
- Decision.
- Alternatives considered.
- Consequences.
- Reversal plan.

## Bidirectional rule

Obsidian is a knowledge mirror and working brain, but GitHub remains authoritative for:

- Project Constitution.
- Versioned architecture contracts.
- Code.
- Roadmap.
- Acceptance criteria.
- Security policy.

When an Obsidian note changes an approved technical direction, the corresponding GitHub document must also be updated through a reviewed change.

## Completion gate

Before an agent marks a task complete, it must answer:

1. Did I update `LLM_HANDOFF.md`?
2. Did I update `CHANGELOG.md` when appropriate?
3. Did I record important decisions?
4. Did I create/update the Obsidian session note?
5. Did I avoid storing secrets?
6. Is the next agent able to continue without chat history?

If any required answer is no, the task remains incomplete.
