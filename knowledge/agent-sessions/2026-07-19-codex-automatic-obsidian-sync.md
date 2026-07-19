# Codex session — automatic Obsidian sync

Date: 2026-07-19

## Outcome

Every successful browser capture now updates a user-owned Obsidian-compatible knowledge vault. The vault contains stable Case, Evidence, and evidence-report notes that remain useful without the application.

## Knowledge preserved

- Case objective and lifecycle state.
- Evidence raw captured text and summary.
- Public source URL.
- Receipt correlation ID and SHA-256 content hash.
- Capture timestamp, extraction method, and confidence.
- Bidirectional Obsidian navigation between Cases, Evidence, and reports.

## Safety boundary

Reports inventory stored Evidence and show limitations. They do not invent conclusions or require a paid model. Raw Evidence is never replaced by generated text.

## Validation

- 107 tests passed.
- Typecheck and build passed.
- Tests cover initial sync, backlinks, provenance, report limitations, Case refresh, and HTTP integration.
