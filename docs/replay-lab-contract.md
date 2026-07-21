# Replay Lab Contract

Replay Lab is the visible forensic surface for Internet Brain OS / Hephaestus.

It is not a generic log viewer. It is the operator-facing explanation of how a Hermes-style agent execution became, or failed to become, a Kernel-controlled cognitive record.

## Purpose

Replay Lab must let a human answer five questions quickly:

1. What did the agent try to do?
2. What evidence did it provide?
3. What claim did it propose?
4. Which Kernel gates accepted, rejected, or blocked the run?
5. What prevention rule or next action follows from the result?

## Non-negotiable invariant

```text
Hermes proposes.
Kernel verifies.
Contradiction checks.
Admission decides.
Durable memory persists only after gates pass.
Replay Lab displays what happened; it does not invent what happened.
```

## Data sources

Replay Lab may display only persisted or derived-from-persisted state from these system-owned sources:

- cognitive pipeline records;
- Hermes ingestion receipts;
- evidence records;
- claim proposals;
- claim validation outcomes;
- contradiction outcomes;
- knowledge admission outcomes;
- durable memory admission records;
- recovery and startup reconciliation records, when available.

It must not display generated explanations that are not explicitly marked as interpretation.

## Primary view

A Replay Lab screen should be centered on one case/pipeline record.

Minimum top-level fields:

- `recordId`
- `idempotencyKey`
- `missionId`
- `taskId`
- `status`
- `startedAt`
- `completedAt`
- `recordedAt`
- `source` such as `hermes`, `sample`, or future connector type

## Timeline contract

The timeline should show events in strict chronological order.

Recommended phases:

```text
1. Run started
2. Evidence recorded
3. Claim proposed
4. Claim validation gate
5. Contradiction engine
6. Knowledge admission gate
7. Durable memory write or rejection
8. Receipt persisted
```

Every timeline item should include:

- phase name;
- timestamp when known;
- actor (`Hermes`, `Kernel`, `Validation Gate`, `Contradiction Engine`, `Admission Gate`, `Storage`);
- status (`accepted`, `rejected`, `blocked`, `replayed`, `pending`, `not_run`);
- source record id or evidence id;
- concise reason when available.

## Evidence panel

The evidence panel must show the evidence Hermes submitted and what the Kernel knows about it.

Minimum fields per evidence item:

- `evidenceId`
- `requirementKey`
- `verified`
- `recordedAt`
- linked claim ids using the evidence;
- missing/unknown reference warnings.

Replay Lab must visually distinguish:

- verified evidence;
- unverified evidence;
- missing evidence reference;
- evidence submitted but not admitted to durable memory.

## Claim panel

The claim panel must show the exact claim text proposed by Hermes.

Minimum fields:

- `proposalId`
- `statement`
- `confidence`
- `evidenceIds`
- `proposedAt`
- validation decision;
- contradiction result;
- admission result.

The UI must never rewrite the claim text without showing that it is a display transformation.

## Idempotency and replay panel

Replay Lab must make replay protection visible.

Minimum fields:

- `idempotencyKey`
- first accepted receipt time;
- replay count, if available;
- payload hash or digest when available;
- current request outcome;
- conflict status for altered replay.

Required statuses:

```text
new_ingestion
safe_replay
conflict_blocked
in_progress
recovered
startup_reconciled
```

When an altered replay is blocked, Replay Lab should explain:

```text
This idempotency key already belongs to a different accepted payload. The Kernel did not rerun gates for the altered payload.
```

## Gate panel

Replay Lab should display gates as explicit decisions, not as hidden implementation details.

Recommended gates:

- shape validation;
- authority-field rejection;
- evidence reference validation;
- claim validation;
- contradiction check;
- knowledge admission;
- durable memory write.

Each gate should show:

- gate name;
- decision;
- reason;
- input ids;
- output ids;
- whether the gate was skipped because a previous gate blocked execution.

## Causality Map

Replay Lab exposes a deterministic causality projection from the persisted cognitive pipeline record. It may show only explicit links: evidence supporting a proposal, the Kernel gates that evaluated it, recorded contradictions with existing claims, and an admitted durable claim.

Every edge carries `basis: persisted_record`. Missing gates or links remain absent; the map must not infer hidden causes, model intent, or explanations that were not recorded.

## AI Autopsy

Replay Lab derives one read-only forensic outcome from persisted execution, validation, contradiction, admission, and attached receipt state. Observed facts retain their system source and source id. Any interpretation is separate, explicitly marked `basis: deterministic_projection`, and carries a limitation that hidden intent and unrecorded root causes are unknown.

Successful admitted cases report `no_failure_observed`; they must not manufacture a failure finding.

## Prevention Rules

For a recorded failure, block, review requirement, incomplete pipeline, or receipt mismatch, Replay Lab may derive one conservative prevention proposal. Every proposal is `proposed_not_enforced`, requires human approval, and cannot mutate Kernel policy or memory. A completed case with no recorded failure produces no prevention proposal.

## Authority boundary warnings

Replay Lab must highlight blocked authority escalation attempts.

Forbidden Kernel-owned fields include:

- `candidate`
- `validation`
- `contradiction`
- `admission`
- `claimValidation`
- `knowledgeAdmission`
- `durableClaim`

If any of these appear in Hermes output, the visible story should be:

```text
Hermes attempted to submit Kernel-owned authority fields. The adapter rejected the output before transport or Kernel processing.
```

The current safe view exposes the enforced boundary and the forbidden field names on every accepted case. It does not claim that a specific accepted case contained an authority attempt: rejected payload contents are intentionally not persisted, and Replay Lab must not fabricate that attribution. Attempt-specific history would require a separate metadata-only security-audit design that never stores rejected values or secrets.

## Local read API

The first local API is documented in:

- `docs/replay-lab-api.md`

Current endpoints:

- `GET /api/replay-lab/cases`
- `GET /api/replay-lab/cases/:id`

They are read-only, authenticated by the existing `/api/*` token guard, and must not mutate receipts, write durable memory, expose fingerprints, or bypass `/hermes/ingestions`.

## Empty and partial states

Replay Lab must handle incomplete data honestly.

Allowed states:

- no evidence submitted;
- malformed input rejected before ingestion;
- ingestion accepted but admission rejected;
- ingestion interrupted and later recovered;
- receipt exists but pipeline record is unavailable;
- startup reconciliation found pending work.

For every partial state, show the missing component explicitly rather than filling it with generated text.

## Operator actions

Initial read-only actions:

- copy record id;
- copy idempotency key;
- copy claim proposal;
- copy evidence ids;
- export case JSON;
- open related docs:
  - `docs/hermes-ingestion-contract.md`;
  - `docs/hermes-real-runtime-validation.md`;
  - `docs/hermes-demo-quickstart.md`;
  - `docs/replay-lab-api.md`.

Future controlled actions:

- mark case reviewed;
- attach human note;
- propose prevention rule;
- generate report from already persisted case data.

Future actions must not mutate durable memory without going through Kernel-controlled gates.

## What Replay Lab must not do

Replay Lab must not:

- accept new Hermes payloads directly;
- bypass `/hermes/ingestions`;
- write durable memory;
- mark claims valid by UI action alone;
- hide rejected evidence;
- hide idempotency conflicts;
- summarize missing data as if it existed;
- expose secrets, HMAC keys, raw authentication headers, or private local paths by default.

## First implementation slice

The first UI/API slice should be small and safe:

1. expose read-only case summary data from existing persisted records;
2. expose evidence and claim proposal panels;
3. expose idempotency status for receipts;
4. add a minimal text-first Replay Lab view;
5. add tests that fixtures do not invent missing gates or evidence.

## Acceptance criteria

The first Replay Lab implementation is acceptable when:

- a successful sample Hermes ingestion can be viewed as a replay case;
- an exact replay is shown as safe replay;
- an altered replay is shown as conflict blocked;
- evidence and claim ids match the original payload;
- forbidden authority fields are documented as pre-transport rejection;
- no secrets are rendered;
- missing fields are shown as missing, not guessed.
