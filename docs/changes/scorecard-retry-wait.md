# Scorecard: full wait across Goal retries

## Change contract

The local scorecard deduplicates executed Goals by Goal ID and revision, but used
the producing mission's authorization to calculate time to useful feedback.
An initial authorization at 10:00, Buscar más at 11:00 and useful feedback at
11:05 therefore reported 5 minutes instead of the user's 65-minute wait.

Use the earliest retained trusted authorization for that exact Goal revision as
the duration origin. Continue validating feedback against the producing mission's
authorization: feedback predating that mission is still excluded. Edited revisions
remain separate samples. Reversed mission order must give the same result.

Files: product-value-scorecard.mjs and its existing tests; measurement specification,
real-Goal evaluation protocol and project continuity records. The change is a local
read-model correction; no source records, SUPPORT decisions, execution authority,
UI layout, API schema or memory are modified.

Risk: historical durations may increase. If earlier missions are absent from the
current store, this snapshot cannot recover their wait. Do not claim a complete
historical warehouse or exact provider latency: the measure ends at explicit
human feedback, including review time.

Proof: three new regressions fail before the fix (300,000 ms instead of 3,900,000)
and pass after. They cover mission order, input immutability, revision isolation and
invalid pre-mission feedback. Rollback: revert this slice; no migration or data rollback.
