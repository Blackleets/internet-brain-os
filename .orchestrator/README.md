# Internal Orchestrator v0

The internal orchestrator is a filesystem-backed, human-gated control plane for bounded development work.

## Safety boundaries

- One active task at a time.
- No direct work on `main`.
- No production deployment.
- No secret or `.env` mutation.
- No autonomous loop.
- Every transition is explicit and reversible until completion.

## State flow

`pending → active → review → completed`

A task may also move from `active` or `review` to `blocked`, and a blocked task may return to `pending`.

## Phase A — contracts and state

`scripts/orchestrator-state.mjs` validates bounded task contracts and enforces the approved state machine. JSON Schemas under `.orchestrator/schemas/` document the durable task and execution-report formats.

## Phase B — prompt and report adapters

`scripts/orchestrator-prompt-adapters.mjs` generates separate bounded instructions for Hermes and Codex from one active task contract. Both prompts include the objective, allowed paths, forbidden paths, acceptance criteria, required commands, approval requirements, and the permanent prohibition on production deployment.

The same module validates returned execution reports before review. It rejects:

- reports for a different task;
- work claimed directly on `main`;
- invalid commit identifiers;
- unknown or missing report fields;
- forbidden or out-of-scope file changes;
- completed reports missing required command output, tests, or acceptance evidence.

A blocked or failed report may omit completion evidence, but it must state the blocker and recommended next action. Prompt generation and report parsing remain local and deterministic; Phase B does not call model APIs, mutate Git, merge changes, deploy, or run autonomously.

## Filesystem CLI

The local CLI persists task contracts under `.orchestrator/tasks/<status>/` and review artifacts under `.orchestrator/reports/`. It never runs Git commands, merges, deploys, modifies secrets, or advances automatically to another task.

```bash
pnpm orchestrator status
pnpm orchestrator create task.json
pnpm orchestrator activate IBOS-0001
pnpm orchestrator report IBOS-0001 execution-report.json
pnpm orchestrator approve IBOS-0001 git-evidence.json --founder-approved
pnpm orchestrator reject IBOS-0001 "correction reason"
pnpm orchestrator inspect IBOS-0001
```

Set `IBOS_ORCHESTRATOR_ROOT` to use an isolated task store. Approval requires a completed Hermes report plus matching Git evidence; contracts marked `requires_founder_approval` also require the explicit `--founder-approved` flag.
