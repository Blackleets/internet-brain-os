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
- Replay Lab real-capture import flow with separate read-only validation and explicit ingestion, server-side HMAC signing, sensitive-data preflight, bounded input, and automatic case refresh; the browser never receives the Hermes boundary secret.
- Safe local `/status` readiness contract for Kernel, Hermes, Replay Lab, Ollama, and Obsidian; Ollama is reported configured only when an actual model is configured, without exposing model or endpoint details.
- Local API tokens reject whitespace/control characters; persisted POSIX token files fail closed when group or world permissions are present, and rotation remains explicit.
- Internal Orchestrator phases A-C: task contracts/state, bounded Hermes/Codex prompts, report validation, and Git evidence decisions.
- PR #76: approval invariants hardened.
- PR #77: filesystem-backed Internal Orchestrator CLI merged with cross-process mutation locking, explicit blocked-task retry, founder gates, and corruption visibility.
- PR #78: durable continuity checkpoint and `pnpm resume` recovery command merged.
- PR #79: clean Kernel runtime build and deterministic Hermes replay/attack smoke repaired.
- PR #85: safe local readiness endpoint merged from a clean `main` branch.
- PR #86: one-command `pnpm verify:first-run` gate merged and proven in CI.
- PR #87: truthful Ollama readiness contract merged and proven in CI.
- PR #92: deterministic Causality Map, AI Autopsy, and read-only Prevention proposals merged and proven in CI.
- PR #94: local API token validation and fail-closed POSIX permission handling merged and proven in CI.
- PR #96: local validate-then-confirm import of authentic Hermes JSON/JSONL captures merged without exposing the Hermes boundary secret.
- Issue #10: Internal Orchestrator v0 closed as completed with PR #73–#77 evidence.
- Issue #57: real Hermes runtime acceptance closed with evidence from a sanitized local Hermes session; signed ingestion, exact replay, altered-replay conflict rejection, authority-field rejection, and Replay Lab visibility were proven.
- Verified real-runtime baseline: lint, typecheck, build, smoke, attack smoke, and 59 test files / 287 tests passed during Issue #57 acceptance.

## Current operating state

- `main` is the sole source of truth and includes the real Hermes acceptance path, deterministic forensic read models, real-capture import UI, and local token-file hardening through PR #96.
- There must be only one active implementation task at a time.
- Do not work directly on `main`.
- Do not merge, deploy, mutate secrets, delete data, or expand scope without the required human/founder gate.
- Always trust `pnpm resume`, `git status`, GitHub PR state, and CI over a stale chat summary.

## Next product priority

Begin **Phase E — Kernel memory-safety expansion** through Issue #98: define the memory quarantine and toxic-memory state machine before implementing persistence or mutation behavior.

The design must specify:

1. States and transitions for proposed, quarantined, admitted, rejected, superseded, and revoked memory.
2. Which persisted evidence and contradiction signals may trigger quarantine recommendations.
3. The human/founder approval gates for release, revocation, or destructive actions.
4. How every transition remains reversible and auditable.
5. How Replay Lab explains why a memory is quarantined without presenting deterministic interpretation as observed fact.
6. Compatibility with current admission records, prevention proposals, receipts, and Kernel authority boundaries.

Do not implement automatic quarantine enforcement in Issue #98. Hermes must never gain authority to admit, quarantine, release, revoke, delete, or otherwise mutate durable memory.

## External acceptance status

Real Hermes runtime acceptance is complete for Issue #57. The sanitized proof came from a real local Hermes session store and did not persist raw prompts, responses, tool output, credentials, tokens, or secrets.

Future product screenshots should use the real Replay Lab investigation or another sanitized authentic run. Generated mockups and synthetic fixtures remain unsuitable as external acceptance evidence.

## Recovery prompt

Copy this into a new chat if continuity is lost:

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Do not mix APO or any other project. First read PROJECT_STATE.md and AGENTS.md, run pnpm resume, inspect GitHub main/open PRs/CI, and treat live Git as newer than chat memory. Preserve all existing security and Kernel-authority invariants. Continue exactly one bounded task from the recorded next priority, with tests and evidence before review or merge.
```

## Update rule

Every merged phase that changes the completed baseline, active blocker, next priority, validation totals, or recovery procedure must update this file in the same PR. Do not append an endless diary here; replace stale operational facts with the newest verified state.
