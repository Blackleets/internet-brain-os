# Codex session — extension Case destination

Date: 2026-07-19

## Outcome

The extension now has a user-facing action. From the popup, a user can capture the current public page into a new Case or attach it as Evidence to an existing active Case.

## Preserved logic

- The extension remains a thin capture and transport client.
- Validation, Case lookup, archived-Case protection, persistence, and projection stay in the local Kernel.
- Target Case participates in deterministic receipt identity.
- A rejected projection does not poison later writes.

## Validation

- 104 tests passed.
- Typecheck and build passed.
- Transport, target validation, active Case listing, missing/archived rejection, and queue recovery are covered.

## Next

Connect stored Evidence to summarization, memory, Obsidian export, and report generation without making a paid LLM mandatory.
