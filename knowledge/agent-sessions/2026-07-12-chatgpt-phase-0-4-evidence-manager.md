---
type: agent-session
agent: ChatGPT
model: GPT-5.6 Thinking
date: 2026-07-12
task_id: issue-6-phase-0-4
status: in-review
pr: pending
---

# Phase 0.4 Evidence Manager

## Objective
Implement the Kernel capability responsible for evidence creation, provenance, integrity validation, metadata updates, and links to Cases, Entities, and Relationships.

## Work completed
- Added `EvidenceRepository` and `EvidenceCaseReader` ports.
- Added repository metadata through `EvidenceRecord.updatedAt` without changing shared domain contracts.
- Added typed Evidence Manager errors with stable codes.
- Added URL, SHA-256 hash, confidence, tag, Entity ID, and Relationship ID normalization.
- Implemented create, retrieve, list, metadata update, Entity linking, and Relationship linking operations.
- Prevented new evidence links to archived Cases.
- Preserved capture fields as immutable by excluding them from update inputs.
- Added defensive-copying repository and public API tests.

## Architectural decisions
- Shared `Evidence` remains the domain value; Kernel-owned `EvidenceRecord` carries update metadata required for stale-write detection.
- Evidence capture fields are immutable after creation.
- Infrastructure remains behind `EvidenceRepository`.
- Evidence may exist without a URL or Case, supporting manual and local sources.

## Risks
- Repository implementations must enforce duplicate IDs and defensive copying under concurrency.
- SHA-256 validation checks digest syntax, not whether the digest matches unavailable content bytes.
- Case archive checks depend on a consistent `EvidenceCaseReader` implementation.

## Scope exclusions
No storage adapter, scraping, OCR, ranking, LLM processing, Entity Manager, Relationship Manager, report generation, browser extension, or Obsidian export was implemented.

## Next step
Open a draft PR linked to Issue #6, inspect CI, correct failures, complete institutional handoff, and merge only after review.
