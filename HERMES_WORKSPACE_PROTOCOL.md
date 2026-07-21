# Hermes Workspace Protocol

This file is the operational map for Hermes and every AI agent working on this repository.

## Canonical repository

- GitHub repository: `Blackleets/internet-brain-os`
- Local repository: the directory containing this file and `.git`
- Product identity: **Hephaestus / Internet Brain OS**
- Do not mix this repository with APO, other temporary copies, Genesis HQ, AEGIS, or Hermes Agent itself.

Before editing, verify the location and Git state:

```bash
pwd
git rev-parse --show-toplevel
git status --short --branch
git remote -v
pnpm resume
```

If the repository root does not contain this file, stop. Do not create a second clone or continue from an incomplete workspace.

## Read order

1. `PROJECT_STATE.md` — current verified checkpoint and active blocker.
2. `AGENTS.md` — mandatory agent contract and invariants.
3. `ARCHITECTURE.md` — system boundaries and priority queue.
4. `HERMES_WORKSPACE_PROTOCOL.md` — this navigation and recovery protocol.
5. The active task, issue, or PR.
6. The target implementation, tests, and exports.

Live Git state, tests, and CI are newer than chat summaries or model memory.

## Ownership map

| Area | Location | Rule |
|---|---|---|
| Kernel authority and domain contracts | `packages/kernel/` | Keep provider-agnostic; preserve evidence, provenance, history, and explicit transitions. |
| Local authenticated boundary | `apps/local-kernel/` | Preserve token, origin, extension identity, replay, idempotency, and loopback security. |
| Hermes adapters and orchestration | `packages/kernel/src/orchestration/`, Hermes scripts | Translate external input into stable contracts; Hermes never receives Kernel authority. |
| Internal development orchestrator | `.orchestrator/`, `scripts/orchestrator-*` | Human-gated task coordination only. |
| Documentation and continuity | `PROJECT_STATE.md`, `ARCHITECTURE.md`, `LLM_HANDOFF.md`, `DECISIONS.md` | Update operational truth when architecture, baseline, blocker, or priority changes. |
| Samples and demonstrations | `examples/`, `docs/` | Sanitized fixtures only; synthetic data is not real Hermes evidence. |

## Safe change loop

Work on exactly one bounded task at a time:

```text
read checkpoint → inspect target/tests/exports → record SHA
→ implement smallest coherent change → add tests
→ typecheck/test/build → inspect diff → update handoff
```

Do not rewrite unrelated files, regenerate the whole repository, or overwrite changes from another workspace. Do not advance a phase without implementation, exports, tests, and Git evidence.

## Branch and Git rules

- Never work directly on `main`; use a named task branch.
- Never use `reset --hard`, `clean`, destructive restore/checkout, or broad deletion to resolve uncertainty.
- Before a commit, run `git status`, inspect `git diff --stat` and `git diff --check`, then validate.
- A commit must describe one coherent task.
- Push only the intended branch. Do not merge or deploy without human/founder approval.

## Recovery when work appears missing

Do not modify anything first. Run:

```bash
git status --short --branch
git reflog -30
git log --oneline --decorate -20
git stash list
git fsck --lost-found --no-reflogs
git diff --name-status
git ls-files --others --exclude-standard
git worktree list
```

Then compare the current root, branch, and remote with this file. Search other copies only to identify the canonical worktree; never copy or delete changes automatically.

## Non-negotiable product boundaries

- Hermes discovers, calls tools/providers, transports, and executes.
- Hephaestus validates, forges evidence/claims/entities/graph/memory, preserves provenance, and owns Kernel decisions.
- External model output is untrusted input.
- Raw Evidence and correlation provenance must survive summaries, retries, replay, and consolidation.
- Provider/model-specific behavior belongs in adapters, not the domain core.

