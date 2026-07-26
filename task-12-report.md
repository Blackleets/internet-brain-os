# Task 12 visual fix pass 1

Implemented the bounded visual correction set from the pass-0 comparison:

- live Shell readiness follows `connectionStore` for both persistent badges;
- ready paired bootstrap copy is concise Spanish rather than raw service text;
- desktop density is tightened for the 1536 × 1024 reference viewport, including a 208 px sidebar;
- the desktop grid E2E assertion now preserves that intentional 208 px visual contract.

TDD evidence: the new behavior/copy tests failed before implementation and then passed (17 focused tests). Dashboard tests passed (9 files, 72 tests); root tests passed (93 files, 542 tests); root typecheck and dashboard production build passed. The canonical E2E command is pending because the main task owner’s pass-1 fixture intentionally occupies port 4100 and the test configuration rejects reuse; no process or E2E configuration was changed. The existing unrelated `apps/dashboard/next-env.d.ts` worktree modification is preserved and excluded from this task.

Visual acceptance remains blocked until the main task owner captures and compares pass-1 browser evidence at the normalized connected fixture state. See `design-qa.md` for exact pass-0 evidence, findings, and required recapture checklist.
