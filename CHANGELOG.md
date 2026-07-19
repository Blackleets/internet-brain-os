## [Unreleased]

### Added
- Local Hephaestus HTTP receiver for browser page context, with bounded validation, durable JSONL inbox, deterministic receipts, restart-safe deduplication, and local-only defaults.
- Shared domain types for Phase 0.2: Case, Evidence, Entity, Relationship, Report, Skill, LLM, and validation helpers.
- Phase 0.3 Case Manager in `packages/kernel`, including repository abstraction, typed domain errors, lifecycle transitions, normalization, logical archiving, and defensive-copying tests.
- Phase 0.4 Evidence Manager in `packages/kernel`, including provenance-preserving creation, metadata updates, Case/Entity/Relationship links, hash validation, stale-write protection, and defensive-copying tests.
- GitHub Actions CI for frozen install, typecheck, tests, and build.

### Changed
- Updated validation to enforce canonical ISO-8601 UTC timestamps.
- Moved test file to packages/shared/test/.
- Exported public API via index.ts.
- Added Kernel-to-Shared workspace resolution for TypeScript and Vitest.

## [0.1.0] - 2026-07-11
### Added
- Initial technical skeleton for Phase 0.1.

# CHANGELOG

All meaningful project changes should be recorded here.

## 2026-07-10

- Initialized repository purpose in `README.md`.
- Added `PROJECT_DNA.md` to define permanent identity and principles.
- Added `PROJECT_BIBLE.md` to define product model, objects, and long-term direction.
- Added `AI_CONSTITUTION.md` to govern LLM and agent behavior.
- Added `LLM_HANDOFF.md` to support continuity between Hermes, OpenCode, Codex, GPT, and other models.
- Added `ROADMAP.md` with controlled product phases.
- Added `DECISIONS.md` with initial product/architecture decisions.
- Added `AGENT_ROLES.md` to define responsibilities and boundaries across models.
- Added Phase 0 tasks and prioritized backlog.
- Added initial system architecture and local/free model strategy.
- Added Obsidian memory structure and mandatory Knowledge Sync protocol.
- Added Hermes operating protocol with model routing, stop conditions, and definition of done.
- Added institutional memory documents under `brain/`.
- Captured founder vision and long-term WOW feature concepts.
- Added strict pull request template for architecture, safety, testing, rollback, and documentation review.
- Strengthened the AI Constitution with zero-knowledge-loss, no-secret, review, and completion-gate rules.
- Updated README with mandatory reading order and company operating model.

## 2026-07-11
- Created technical skeleton for Phase 0.1: monorepo structure with apps/ and packages/
- Added base TypeScript configuration with project references
- Configured pnpm workspaces and install/test/typecheck/build scripts
- Added .gitignore for Node/TypeScript
- Added placeholder source files and tsconfig for each package
- Validation: pnpm install, typecheck, test, and build all pass
