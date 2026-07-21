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
- Replay Lab Causality Map derived only from explicit persisted evidence, proposal, gate, contradiction, admission, and durable-claim links.
- Replay Lab AI Autopsy and Prevention projections derived deterministically from recorded state, with observed facts separated from interpretation and all prevention proposals read-only pending human approval.
- Safe local `/status` readiness contract for Kernel, Hermes, Replay Lab, Ollama, and Obsidian; Ollama is reported configured only when an actual model is configured, without exposing model or endpoint details.
- Internal Orchestrator phases A-C: task contracts/state, bounded Hermes/Codex prompts, report validation, and Git evidence decisions.
- PR #76: approval invariants hardened.
- PR #77: filesystem-backed Internal Orchestrator CLI merged with cross-process mutation locking, explicit blocked-task retry, founder gates, and corruption visibility.
- PR #78: durable continuity checkpoint and `pnpm resume` recovery command merged.
- PR #79: clean Kernel runtime build and deterministic Hermes replay/attack smoke repaired.
- PR #85: safe local readiness endpoint merged from a clean `main` branch.
- PR #86: one-command `pnpm verify:first-run` gate merged and proven in CI.
- PR #87: truthful Ollama readiness contract merged and proven in CI.
- PR #92: deterministic Causality Map, AI Autopsy, and read-only Prevention proposals merged and proven in CI.
- Issue #10: Internal Orchestrator v0 closed as completed with PR #73–#77 evidence.
- Validation baseline: `pnpm verify:first-run` passes in CI and from a clean Git clone with 56 test files / 275 tests, covering typecheck, build, bounded JSON and native JSONL validation, signed ingestion, exact replay, altered-replay rejection, and Replay Lab API.

## Current operating state

- `main` is the sole source of truth and includes the complete deterministic forensic read path through PR #92.
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Next product priority

External acceptance and product evidence — validate one sanitized real Hermes capture for Issue #57 and capture screenshots of that real investigation in Replay Lab. Do not replace either proof with synthetic evidence.

Issue #57 remains an external acceptance proof, not an implementation blocker: validate the secured Hermes ingestion path when one sanitized output from the user's real Hermes runtime is available.

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
