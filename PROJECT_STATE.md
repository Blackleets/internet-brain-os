# HEPHAESTUS — Current Project State

This is the canonical short checkpoint for recovering work after a lost, compacted, or unavailable chat. GitHub and the live Git state remain the source of truth when they are newer than this document.

## Recovery command

```bash
pnpm resume
```

Then read, in order:

1. `PROJECT_STATE.md`
2. `AGENTS.md`
3. `ARCHITECTURE.md`
4. The active GitHub issue or pull request
5. The target implementation and tests

## Project identity

- Product: **HEPHAESTUS — The Intelligence Forge**.
- Technical repository: `Blackleets/internet-brain-os`.
- Do not mix this repository with APO, Genesis HQ, AEGIS, Hermes Agent, or any other project.
- Hermes is the external discovery/tool/execution layer.
- Hephaestus is the evidence, validation, memory, causality, and knowledge-forging Kernel.

## Stable completed baseline

- Secure local Hermes ingestion, HMAC body binding, idempotency, replay protection, recovery, and startup reconciliation.
- Mission execution, claim proposal, contradiction, knowledge admission, and durable cognitive-pipeline storage.
- Replay Lab read model, authenticated local API, smoke test, and minimal operator UI.
- Internal Orchestrator phases A-C: task contracts/state, bounded Hermes/Codex prompts, report validation, and Git evidence decisions.
- PR #76: approval invariants hardened.
- PR #77: filesystem-backed Internal Orchestrator CLI merged with cross-process mutation locking, explicit blocked-task retry, founder gates, and corruption visibility.
- PR #78: durable continuity checkpoint and `pnpm resume` recovery command merged.
- Validation baseline: clean build, Hermes signed-ingestion smoke, altered-replay attack smoke, 54 test files and 266 tests, and typecheck passing.

## Current operating state

- `main` was clean and synchronized after PR #78 at `5ad60c2` before the Hermes runtime-build repair was created.
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Next product priority

Issue #57 — validate the secured Hermes ingestion path using one sanitized output from the user's real Hermes runtime.

Required proof:

1. Validate the real output without weakening Kernel authority.
2. Ingest it through the signed local boundary.
3. Prove exact replay returns the same cognitive record.
4. Prove altered replay is rejected.
5. Prove Hermes cannot submit validation, contradiction, admission, candidate, claim, or durable-memory authority.
6. Display the resulting investigation in Replay Lab.

## External blocker

The repository cannot manufacture a real Hermes execution. The user must provide a sanitized console, Telegram, JSON, or JSONL output. Never fabricate this evidence or mark Issue #57 complete using only the existing synthetic fixtures.

## Recovery prompt

Copy this into a new chat if continuity is lost:

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix APO or any other project. First read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve all existing security and Kernel-authority invariants. Continue exactly one bounded task from the recorded next priority, with tests and evidence before review or merge.
```

## Update rule

Every merged phase that changes the completed baseline, active blocker, next priority, validation totals, or recovery procedure must update this file in the same PR. Do not append an endless diary here; replace stale operational facts with the newest verified state.
