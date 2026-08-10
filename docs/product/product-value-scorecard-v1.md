# Efesto Product Value Scorecard v1

This slice implements Issue #186 as a **local-first read model**. Its purpose is to measure whether Efesto creates user value without weakening the privacy or authority model.

## Source of truth

The scorecard is computed from the existing local Kernel store only:

- trusted Goal execution authorization receipts;
- Agent Missions;
- Kernel-verified Evidence carrying `missionId` provenance;
- Opportunities/Finds carrying `evidenceId` provenance;
- explicit private feedback: `useful`, `saved`, `dismissed`, `not_interested`.

No search snippet becomes Evidence. No feedback changes Evidence truth. No metric creates execution authority.

## Measurable now

- **Goal → Useful Find Rate**: unique authorized Goal revisions with at least one valid Goal-linked `useful`/`saved` Find divided by unique authorized Goal revisions.
- **Time to First Useful Find**: median elapsed time from trusted Goal authorization to the first valid useful/saved feedback event for that Goal revision.
- **Mission completion rate**: completed Mission records divided by current Mission records.
- **Finds per completed Goal**: Goal-linked Finds produced by completed Goal revisions divided by completed Goal revisions.
- **Useful/saved Find share**: Goal-linked Finds marked useful/saved divided by Goal-linked Finds.
- **Mission failure rate** and **dismissal/not-interested rate**.

The first version is a current local snapshot. It does not pretend to be a historical warehouse.

## Explicitly not measurable yet

Efesto returns `status: not_measurable` instead of inventing values for:

- Repeat Goal Usage as a user cohort rate — no multi-user activation identity exists in the local instance.
- Installation → first Goal activation rate — install/cohort timestamps are not part of the knowledge store.
- Goal → notification delivery rate — there is no canonical notification-delivery ledger in the local store.
- Altered-replay acceptance incidents, unauthorized memory admission incidents and credential/privacy leakage incidents — security contracts exist, but there is not yet a local incident event ledger suitable for product analytics.
- Packaged install/repair success — this evidence lives in release CI, not the local knowledge store.

Targets such as zero unauthorized admission remain security invariants; an absent analytics ledger must never be reported as measured zero.

## Privacy boundary

`productScorecard.privacy` is fixed to:

```json
{ "mode": "local_only", "externalTelemetry": false }
```

The scorecard is carried through the existing authenticated `GET /api/preferences` response as an additive `profile.productScorecard` field. No telemetry upload route, new network authority or background export is introduced.

## Data quality

The read model reports coverage counters for Goal-linked Finds, feedback events, feedback outside Goal provenance and impossible timestamps. Positive feedback recorded before the trusted authorization timestamp is excluded instead of producing a negative time-to-value.
