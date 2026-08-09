# G4.1a — Automatic read-only continuation contract

Status: bounded Kernel policy contract. This layer defines eligibility only. It does not wire a worker, change a UI confirmation flow, create a Mission, or grant any capability/memory authority.

## Product rule

A persisted active Goal is **not** sufficient authorization for autonomous work.

Automatic continuation is eligible only when all of the following are true:

1. an explicit human/founder authorization receipt exists;
2. the receipt is approved, scoped to `read_only_continuation`, and bound to the same Goal id and exact Goal revision;
3. the Goal is still active;
4. the Goal approval policy does not require approval for every action or an unresolved custom policy;
5. the capability has already passed the normal capability authorization path;
6. the capability is available and `r0_observe` only;
7. the capability consent policy is not `always`.

Any Goal revision invalidates the previous automatic-continuation receipt. Paused, completed, failed and cancelled Goals cannot start or continue new automatic work through this policy.

## Authority boundary

`evaluateAutomaticReadOnlyContinuation()` is a second, read-only policy gate. An `allowed: true` result means only:

> this already-authorized R0 operation may continue without another prompt under the recorded Goal confirmation.

It does **not**:

- authorize a capability;
- create or claim a Mission;
- approve R1/R2/R3 work;
- approve login, purchase, form submission, outreach, download or destructive actions;
- admit Evidence into durable memory;
- mutate Goal status;
- let Hermes or another agent create its own authorization receipt.

The Execution/Capability gates remain independently mandatory.

## Receipt contract

Schema: `efesto.goal-execution-authorization.v1`.

Required binding:

```text
authorization id
→ Goal id
→ exact Goal revision
→ approved decision
→ read_only_continuation scope
→ human/founder actor
→ decision timestamp
```

An agent/system actor is never accepted as the source of this user authorization.

## Fail-closed decisions

The pure policy denies automatic continuation for:

- malformed runtime input;
- missing/rejected authorization;
- agent/system authorization actor;
- wrong Goal id or stale Goal revision;
- single-action-only receipt;
- non-active Goal;
- `all_actions` or unresolved `custom` approval policy;
- degraded/unavailable capability;
- R1 reversible, R2 external or R3 irreversible capability;
- capability consent policy `always`.

No denial needs private Goal title/desired-outcome content in its output.

## Existing runtime truth

The one-click Kernel already detects a real Hermes runtime and can automatically run a newly created queued Mission with bounded retries. G4.1a does not broaden that runtime. It defines the explicit policy proof that subsequent G4 layers must persist and enforce before claiming autonomous read-only continuity.

## Next bounded layers

- **G4.1b:** persist a revision-bound Goal execution authorization receipt at the existing explicit confirmation boundary; evaluate before touching worker execution.
- **G4.1c:** require the policy decision before automatic worker continuation; preserve existing Capability Registry/Execution Engine gates.
- **G4.1d:** prove retries/crash recovery/idempotency do not duplicate Evidence/Finds/notifications.
- **G4.1e:** prove web + extension automatically refresh the same persisted Goal/Mission/Find truth without another harmless-read prompt.
- **G4.1f:** adversarial freeze and exact-package qualification.

Cross-device phone → PC transport remains outside G4 and needs a separate threat model.
