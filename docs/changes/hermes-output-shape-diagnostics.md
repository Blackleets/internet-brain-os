# Safe Hermes rejected-output diagnostics

## Observed failure and bounded change

Authentic run https://github.com/Blackleets/internet-brain-os/actions/runs/38051253204 on immutable .94 head 80c94658022700cfd47c0193fef1b207d5ba19a3 failed 8/14. The parsed-output findings-array/20-item gate rejected the response. Zero candidates, Evidence and SUPPORT Finds were admitted. The old generic error does not establish whether findings was missing, had the wrong type or exceeded twenty. The actual response is unavailable; no guessed payload is a reproduced live cause.

.95 adds safe shape diagnosis at this existing rejection, without changing accepted inputs or repairing the model. Root and findings types use fixed JSON type names (null, array, object, string, number, boolean); findings may also be missing. Count is none or over_20. No model keys, values, URLs, surrounding prose or reasoning are copied into this diagnostic. Schema, URL, source verification, SUPPORT, authorization, memory, retry budgets and output limits stay unchanged. A valid JSON response with an invalid schema never enters literal-URL fallback.

Files: scripts/hermes-efesto-adapter.mjs, its tests, worker sanitization regression and continuity/candidate records. Ten negative adapter cases cover malformed types and excessive count while checking privacy. Worker wiring checks that only a failure is reported and no candidate results are submitted. Existing valid candidates, unsafe URLs, authority-field rejection and bounded fallback cases remain covered.

## Qualification and recovery

Freeze .94 as failed, retaining its four green workflows as separate evidence. .95 requires fresh local checks and remote qualification on one unchanged SHA. A successful future live run qualifies only that candidate and does not retroactively fix .94 or prove the underlying stochastic response failure is solved. If the failure recurs, use shape metadata to select a supported hypothesis; never relax schemas, extend authority or retry until green without diagnosis. Queued plus lastFailure is the existing observable retry state, not successful completion.

Risk: error copy gains a bounded suffix; consumers should retain existing prefix compatibility. No storage migration or new authority. Rollback only the adapter suffix and its tests; preserve historical failure records and immutable release identities. Price/stock/freshness assessment and real-Goal/Windows UAT remain separate outstanding work. Keep PR #266 draft/open/unmerged; publicLaunchApproved=false.
