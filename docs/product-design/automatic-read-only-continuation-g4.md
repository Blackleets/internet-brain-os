# G4 — Automatic authorized read-only continuation

Status: bounded Kernel/runtime work. G4 is executed layer-by-layer; each layer must pass before the next one changes behavior.

## Product rule

A persisted active Goal is **not** sufficient authorization for autonomous work. Possessing the local API token is also not sufficient evidence that a human approved autonomous continuation.

Automatic continuation is eligible only when all of the following are true:

1. an explicit trusted-user authorization receipt exists;
2. the receipt is approved, scoped to `read_only_continuation`, and bound to the same Goal id and exact Goal revision;
3. the Goal is still active;
4. the Goal approval policy does not require approval for every action or an unresolved custom policy;
5. the capability has already passed the normal capability authorization path;
6. the capability is available and `r0_observe` only;
7. the capability consent policy is not `always`.

Any Goal revision invalidates the previous automatic-continuation receipt. Paused, completed, failed and cancelled Goals cannot start or continue new automatic work through this policy.

## G4.1a — policy contract ✅

Kernel policy: `efesto.automatic-read-only-policy.v1`.

`evaluateAutomaticReadOnlyContinuation()` is a second, read-only policy gate. An `allowed: true` result means only:

> this already-authorized R0 operation may continue without another prompt under the recorded Goal confirmation.

It does **not** authorize a capability, create or claim a Mission, approve R1/R2/R3 work, grant external side effects, admit durable memory, or mutate Goal status.

The policy fails closed for malformed input, missing/stale/wrong receipts, agent/system approval actors, inactive Goals, side-effect risk, unavailable capabilities, and always-consent capabilities.

G4.1b refines the user-actor vocabulary before any persisted receipt exists: the normal interactive product surfaces mint `actorType: interactive_user`; a separately trusted founder path may use `founder`. A raw boolean is never represented as proof of a human identity.

## G4.1b — persist confirmation provenance

The existing `AgentMissionManager.create()` boundary already rejects mission creation unless `confirmed === true`. G4.1b makes trusted interactive confirmation durable without trusting a client-supplied actor claim.

### Trusted HTTP boundary

The local server already authenticates the Kernel token, rejects hostile browser origins, and independently checks paired extension identity. After those checks, the Mission route classifies only these interactive surfaces:

- paired/authorized `chrome-extension://…` origin → `interactive_user / extension-ui`;
- local Control Center (`localhost` / `127.0.0.1`) or explicitly allowed dashboard origin → `interactive_user / dashboard-ui`.

A token-bearing request with no trusted interactive Origin may still create the same explicitly confirmed manual Mission for compatibility, but **it receives no automatic-continuation receipt**. This prevents the Hermes worker or another local token holder from turning `confirmed:true` into self-granted user authority.

### Receipt

At the trusted boundary the local Kernel-side adapter may mint:

```text
efesto.goal-execution-authorization.v1
id = deterministic goal-auth:<sha256>
goalId = persisted Goal id
goalRevision = exact current revision (legacy compatibility = 1)
decision = approved
scope = read_only_continuation
actorType = interactive_user | founder
decidedBy = trusted surface class / trusted founder identity
decidedAt = same clock used to create, authorize, or restart the Mission
```

Rules:

- client-supplied `authorization` fields are ignored;
- a new trusted interactive confirmation may add a receipt to a live pre-G4 Mission without duplicating the Mission;
- an idempotent call against a live Mission that already has a receipt returns the existing receipt;
- an explicitly confirmed trusted restart of a terminal Mission gets a fresh receipt and timestamp;
- lease reconciliation preserves the receipt as provenance and never upgrades its scope;
- missing `confirmed:true` still creates neither Mission nor receipt;
- trusted Origin classification is server-derived, not body-derived;
- the receipt is persisted with the Mission but still does not grant capability or memory authority by itself.

### Current compatibility note

The current local radar Goal is immutable and has no revision field, so its compatibility revision is `1`, matching Shared Goal Truth. UniversalGoal v2 uses `currentRevision.revision`. Future Goal mutation therefore invalidates earlier receipts when the policy compares persisted authorization to current Goal truth.

## Authority boundary

The Execution/Capability gates remain independently mandatory. G4 does not approve:

- login;
- purchase/payment;
- form submission;
- outreach/messages;
- downloads or destructive actions;
- durable-memory admission.

An agent/system actor is never accepted as the source of user automation authorization.

## Existing runtime truth

The one-click Kernel already detects a real Hermes runtime and can automatically run a newly created queued Mission with bounded retries. **G4.1a–b do not broaden or gate that worker yet.** They create the policy and trustworthy persisted authorization provenance that G4.1c must enforce before automatic continuation is claimed as secure.

## Next bounded layers

- **G4.1c:** require the policy decision before automatic worker continuation; preserve existing Capability Registry/Execution Engine gates.
- **G4.1d:** prove retries/crash recovery/idempotency do not duplicate Evidence/Finds/notifications.
- **G4.1e:** prove web + extension automatically refresh the same persisted Goal/Mission/Find truth without another harmless-read prompt.
- **G4.1f:** adversarial freeze and exact-package qualification.

Cross-device phone → PC transport remains outside G4 and needs a separate threat model.
