# File Manifest for ChatGPT Project

Upload or connect these files to the ChatGPT Project.

## Required governance and vision

- `README.md`
- `PROJECT_DNA.md`
- `PROJECT_BIBLE.md`
- `AI_CONSTITUTION.md`
- `ROADMAP.md`
- `DECISIONS.md`
- `AGENT_ROLES.md`

## Required operating context

- `LLM_HANDOFF.md`
- `CHANGELOG.md`
- `docs/architecture.md`
- `docs/ENGINEERING_STANDARDS.md`
- `docs/REPOSITORY_STANDARDS.md`
- `docs/hermes-operating-protocol.md`
- `docs/obsidian-sync-protocol.md`
- `docs/free-model-strategy.md`

## Institutional memory

- `brain/FOUNDER_VISION.md`
- `brain/BRAIN_LOG.md`
- the most recent notes under `knowledge/agent-sessions/`

## Active implementation context

For each phase, also provide:

- the active GitHub Issue
- the active draft Pull Request, when one exists
- relevant files from `packages/shared/src/`
- relevant files from `packages/kernel/src/`
- relevant tests from `packages/*/test/`
- root `package.json`
- root `tsconfig.json`
- `tsconfig.base.json`
- `vitest.config.ts`
- `.github/workflows/ci.yml`

## Avoid unnecessary uploads

Do not upload:

- `node_modules/`
- `dist/`
- build artifacts
- lockfile duplicates
- secrets or `.env` files
- unrelated generated files

## Refresh rule

Refresh the Project files after each merged phase or whenever a governance/architecture file changes. GitHub remains canonical when Project files become stale.
