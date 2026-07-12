---
type: agent-session
agent: ChatGPT
model: GPT-5.6 Thinking
date: 2026-07-11
task_id: issue-4-phase-0-3
status: in-review
pr: pending
---

# Phase 0.3 Case Manager

## Objective
Implement the first executable Kernel capability: deterministic, storage-agnostic Case lifecycle management.

## Work completed
- Added the `CaseRepository` port.
- Added typed Case Manager errors with stable codes.
- Added input normalization for title, objective, description, and tags.
- Implemented create, retrieve, list, update, status transition, and logical archive operations.
- Enforced the approved lifecycle: draft → active → completed → archived, with direct archive paths.
- Added defensive-copying in-memory repository tests.
- Added public API smoke tests.
- Added GitHub Actions validation for install, typecheck, tests, and build.

## Architectural decisions
- The Kernel owns lifecycle logic; persistence remains behind `CaseRepository`.
- IDs and timestamps are caller-supplied.
- Archived Cases are terminal and cannot be mutated.
- Duplicate detection is performed in the manager; persistent adapters must also enforce uniqueness against races.
- Case tags are always arrays and are normalized deterministically.

## Risks
- Client-supplied timestamps assume canonical UTC values and synchronized clocks.
- Repository adapters must honor defensive-copying and uniqueness semantics.
- CI validation is required before merge because implementation was authored remotely through GitHub.

## Scope exclusions
No Evidence Manager, database, filesystem persistence, Event Bus, LLM routing, Obsidian exporter, extension, dashboard, scraping, or Phase 0.4 work was implemented.

## Next step
Open a draft PR linked to Issue #4, inspect CI, correct any failures, and merge only after strategic review.
