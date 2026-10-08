# Goal revision during pending verification

## Scope and reason

Founder requests continued Efesto reliability improvements without changing its design. Start from main 8d56cf89f9292bf67b1ee9b696e0560f69049082; incorporate the two-file correction reviewed in PR #255. The old lease-only edit guard permits a revision while search candidates await Kernel verification. The verifier correctly denies the now-stale authorization, but the mission remains blocked with no live lease.

## Behavior and files

GoalManager refuses changed content with existing 409 GOAL_MISSION_RUNNING during pending verification. It uses the existing settlement contract to leave already blocked or settleable records editable. The Forge read model supplies an explanation to the existing GoalEditSheet; saving is disabled while work is pending, and typed text survives an observed state transition. The Kernel repeats its guard atomically and remains authoritative for races and other clients.

Implementation: apps/local-kernel/goals.mjs and apps/dashboard/lib/forge/forge-model.ts. Tests cover revision refusal, no store mutation, subsequent verification and successful editing, stale authorization rejection, settlement compatibility, partial batches, active/expired leases, and editor state transitions. A Gherkin acceptance record describes the invariant. No protected domain module, SUPPORT rule, authority, provider, credential, user-store migration or visual layout changes.

## Acceptance, risk and rollback

- A submitted candidate batch cannot lose its authorized Goal revision to an ordinary edit.
- Verification still produces its own Evidence and SUPPORT verdict; editing is available afterward.
- Already blocked or settleable records are not silently repaired or permanently locked by this guard.
- Desktop/mobile editor explains pending verification and sends no save request while blocked.
- Architecture, types, full tests, build, SQLite, first-run and browser gates qualify the candidate. Fixtures do not establish founder-PC or authentic Hermes UAT.

Risk: the read model can lag the Kernel; a racing request is still rejected at the authoritative transaction. Existing policy-blocked missions require their existing explicit recovery path and are not retroactively fixed by this change. Roll back this slice's commits only; no data rollback or deletion. Candidate .89 supersedes frozen .88 for qualification; publicLaunchApproved remains false.
