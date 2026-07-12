---
type: agent-session
agent: ChatGPT/Codex
model: GPT-5
date: 2026-07-12
task_id: issue-6-phase-0-4
status: ready-for-ci-review
pr: 7
---

# Phase 0.4 Evidence Manager

## Objective
Implement and review the Kernel capability responsible for evidence creation, provenance, integrity validation, metadata updates, and links to Cases, Entities, and Relationships.

## Work completed
- Added `EvidenceRepository` and `EvidenceCaseReader` ports.
- Added Kernel-owned `EvidenceRecord.updatedAt` without changing shared contracts.
- Added stable typed errors for duplicates, missing evidence, invalid inputs, stale writes, and archived Case links.
- Added URL, SHA-256 hash, confidence, tag, Entity ID, and Relationship ID normalization.
- Implemented create, retrieve, filtered list, metadata update, Entity link/unlink, Relationship link/unlink, and explicit Case attach/detach.
- Prevented links to missing or archived Cases.
- Preserved capture fields as immutable through the public update contract.
- Added defensive-copying, public API, and complete link lifecycle tests.

## Architectural decisions
- Shared `Evidence` remains the domain value; Kernel-owned `EvidenceRecord` carries update metadata.
- Evidence capture fields cannot be supplied to metadata updates.
- Infrastructure remains behind `EvidenceRepository`.
- Evidence may exist without a URL or Case.
- Persistent adapters must eventually provide atomic compare-and-update semantics for concurrent writers.

## Validation
The branch previously passed frozen install, typecheck, tests, and build. New review commits require a fresh green GitHub Actions run before merge.

## Risks
- SHA-256 validation checks digest syntax, not correspondence with unavailable bytes.
- Case archive checks depend on a consistent `EvidenceCaseReader`.
- Concurrency protection must be enforced by future persistence adapters.

## Scope exclusions
No persistence adapter, scraping, OCR, ranking, LLM processing, Entity Manager, Relationship Manager, report generation, browser extension, or Obsidian exporter was implemented.

## Next step
Review the new CI run, merge PR #7 only when green, then create the next bounded Phase 0 issue.
