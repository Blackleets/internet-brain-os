# Task 12 — final visual QA and responsive hardening

The source-normalized pass closed every P0/P1/P2 visual finding without changing Kernel contracts or inventing Phase 2 data:

- persistent shell readiness follows the live connection store;
- ready/paired copy is concise Spanish;
- desktop density fits the 1536 × 1024 reference viewport;
- the malformed tablet grid declaration is repaired so the mobile breakpoint executes;
- mobile metrics collapse to one readable column with no horizontal overflow;
- decorative Forge artwork is hidden at the 390 × 844 breakpoint as intended;
- Turbopack is pinned to the isolated repository root, removing machine-dependent workspace inference.

TDD evidence: mobile overflow failed at 422 px against a 390 px viewport before the CSS parser fix; the Forge slot then failed the new hidden assertion before the specificity fix. Final focused and canonical checks passed: dashboard 73/73, E2E 3/3, typecheck and production build.

Visual evidence and the truthful Phase 1 residual boundary are recorded in `design-qa.md`, which ends with `final result: passed`.
