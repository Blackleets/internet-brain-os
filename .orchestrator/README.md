# Internal Orchestrator v0

Phase A provides a filesystem-backed, human-gated task state contract for internal development work.

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

The implementation lives in `scripts/orchestrator-state.mjs`. JSON Schemas under `.orchestrator/schemas/` document the durable task and execution-report contracts.