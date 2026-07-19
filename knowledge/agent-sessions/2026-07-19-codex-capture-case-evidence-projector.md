# Codex session — capture to Case/Evidence projector

Date: 2026-07-19

## Outcome

An accepted browser capture now enters the canonical Hephaestus knowledge loop as one deterministic draft Case and one Evidence record. The Evidence retains `sourceReceiptId`, source URL, visible text, content hash, extraction method, timestamp, confidence, and Case relationship.

## Invariants preserved

- Evidence-first: no conclusion is generated without stored source content.
- Local-first: records use the existing `.hephaestus/store.json` structure.
- Replay safety: the same receipt always resolves to the same Case and Evidence IDs.
- Knowledge preservation: existing CLI Cases and Evidence remain untouched.
- Loss prevention: inbox persistence occurs before projection, so failures can be retried.

## Current boundary

The extension cannot yet choose an existing Case. A unique capture therefore starts a new draft Case. Case selection is the next explicit UX and transport-contract task.

## Validation

- 99 tests passed.
- Typecheck passed.
- Build passed.
- End-to-end HTTP coverage confirms one persisted Case/Evidence pair and retry deduplication.
