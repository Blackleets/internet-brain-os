# Contributing to Efesto / Internet Brain OS

First off: thank you. This project runs on the belief that people should never think alone in front of an ocean of information.

## Before you start

Efesto has a **Constitution** (`CONSTITUTION.md`) — the durable product, safety and engineering contract. `AGENTS.md` summarizes the working protocol. Both are short reads and they are binding for human contributors too, not just AI agents.

The three invariants most likely to affect your PR:

1. **Read-only surfaces stay read-only.** MCP tools, dashboard views and extension UIs never mutate Kernel state directly; writes go through authenticated Kernel contracts.
2. **Evidence and provenance are never silently discarded.** If your change drops provenance fields, expect review pushback.
3. **Smallest coherent change.** One behavior per PR, tests included, gates green.

## Setup

```bash
pnpm install
pnpm typecheck   # must pass before you start (fixes go in a separate commit)
pnpm test        # baseline: know what was green before you touched it
```

## The change protocol

1. Branch from `main`: `feat/<topic>` or `fix/<topic>`.
2. Follow TDD where practical: write the failing test, watch it fail, implement minimally.
3. Gates before pushing:
   ```bash
   pnpm typecheck && pnpm test && pnpm build
   ```
4. Open a Pull Request against `main`. Describe *what* changed, *why*, and paste the verbatim test summary lines.
5. A maintainer or reviewer agent audits against the Constitution before merge. Merges squash unless history is cleaner linear.

## Where things live

| Path | What |
|---|---|
| `apps/local-kernel/` | The local Kernel server (`.mjs`, node:test) — including the MCP surface |
| `packages/kernel/` | Typed domain core (vitest): entities, evidence, goals, storage |
| `apps/dashboard/` | Next.js control center (vitest + Playwright e2e) |
| `apps/extension/` | Browser capture surface (plain JS + node:test-style suites) |
| `docs/` | Architecture guardrails, operating protocols, launch kit |

## Testing notes

- `apps/local-kernel` uses Node's built-in runner: `node --test <file>.test.mjs`.
- Packages use vitest; if a test imports `node:*` builtins that Vite cannot resolve (e.g. `node:sqlite`), mirror it as a `.nodetest.mjs` run by `node --test` and note why in the PR.
- Never weaken an existing behavioral assertion to make a test pass. Update selectors when UI changes, keep the contract.

## Communication

Open issues before large refactors. Spanish and English both welcome — the Founder works in Spanish; docs alternate between them.
