# Recover a historical Goal revision block

## Scope and authorization

Founder instruction on 2026-10-08: improve first; merge only when instructed later. Work on improve/efesto-blocked-goal-recovery from main 4e846763114b076fb835287571fc9647c214353c. Keep the PR draft and do not merge, deploy to production or update the founder's installer for this candidate. PR #265 is already integrated and had five successful workflows, 35 browser tests and authentic Hermes 14/14; that is prior-baseline proof, not this branch's qualification.

## Problem and change

The previous guard prevents new revision mismatches during verification. Historical missions blocked with authorization_revision_mismatch still appear as a generic policy block with no visible way to request a fresh attempt. The existing authenticated, interactive search_more endpoint already supports this recovery, but the Forge client hides it for every blocked phase.

Display the existing Buscar más action only for the exact persisted revision-mismatch block on running/verifying missions, without an automatic policy block or a live lease. Explain that the previous Goal text cannot be used; clicking explicitly confirms a new attempt under the current Goal. Keep all other policy blocks unchanged. The client does not renew receipts, clear blocks, read pages or create Evidence. The Kernel's existing confirmation, authorization, scope, bounded retry and SUPPORT gates remain authoritative.

When search_more archives this known block, retain its exact Kernel reason in priorAttempts alongside the already retained candidates/results. Old Evidence and Finds stay untouched. Do not rerun the denied candidate batch or migrate historical stores.

## Files, acceptance and rollback

Implementation: apps/dashboard/lib/forge/forge-model.ts, apps/dashboard/components/forge/forge-live-view.tsx, apps/dashboard/components/efesto-product-shell.tsx (truthful request acknowledgement), and apps/local-kernel/agent-missions.mjs (archive metadata only). Tests prove the known-block action/copy, no action for generic policy blocks/live leases/missing rows, no implicit callback, fresh confirmation required, a current-revision receipt, retained previous block/Evidence/Finds, and subsequent independently verified results. Add desktop/mobile browser coverage and an acceptance feature.

Risk: a stale client can offer a request after a new lease begins; the existing Kernel endpoint preserves the active mission. No new execution authority is granted. Rollback this slice only, without deleting user data. Qualification requires architecture, types, full tests, build and exact-head remote browser/Windows checks. Candidate .90 is unmerged; publicLaunchApproved stays false. Founder-PC UAT remains unverified.
