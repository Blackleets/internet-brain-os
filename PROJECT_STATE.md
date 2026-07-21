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
- Replay Lab read model, authenticated local API, smoke test, and minimal operator UI with a safe pre-ingestion authority-boundary explanation.
- Internal Orchestrator phases A-C: task contracts/state, bounded Hermes/Codex prompts, report validation, and Git evidence decisions.
- PR #76: approval invariants hardened.
- PR #77: filesystem-backed Internal Orchestrator CLI merged with cross-process mutation locking, explicit blocked-task retry, founder gates, and corruption visibility.
- PR #78: durable continuity checkpoint and `pnpm resume` recovery command merged.
- PR #79: clean Kernel runtime build and deterministic Hermes replay/attack smoke repaired.
- Issue #10: Internal Orchestrator v0 closed as completed with PR #73–#77 evidence.
- Issue #57: real local Hermes runtime validation completed and closed with sanitized session-derived evidence, signed ingestion, exact replay, altered-replay rejection, authority-field rejection, and Replay Lab visibility.
- Validation baseline on the updated PR branch: clean lint, typecheck, build, Hermes signed-ingestion smoke, altered-replay attack smoke, 59 test files and 287 tests passing.

## Current operating state

- PR #83 is open for authorized profile/token hardening, updated with `origin/main`, mergeable, and CI green.
- Issue #57 is closed with evidence in the GitHub issue comment.
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Next product priority

Capture sanitized screenshots from the real local Replay Lab interface, then proceed to the bounded memory-safety expansion.

Required proof for screenshots:

1. Use a real local Replay Lab case, not a generated mockup.
2. Hide or omit tokens, secrets, raw prompts, and private data.
3. Show the investigation-level view: case, evidence, claim proposal, Kernel gates, idempotency/replay state, and authority boundary.
4. Add the screenshot only if it is a real local interface capture and safe for public repo review.

## External blocker

The previous real-Hermes-output blocker is resolved. Future real-runtime validations must still use sanitized outputs and must never fabricate evidence or grant Hermes Kernel authority.

## Recovery prompt

Copy this into a new chat if continuity is lost:

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix APO or any other project. First read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve all existing security and Kernel-authority invariants. Continue exactly one bounded task from the recorded next priority, with tests and evidence before review or merge.
```

## Update rule

Every merged phase that changes the completed baseline, active blocker, next priority, validation totals, or recovery procedure must update this file in the same PR. Do not append an endless diary here; replace stale operational facts with the newest verified state.
