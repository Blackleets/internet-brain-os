# AI Forensics Case Study

## Case: The autonomous agent that almost polluted memory

This case study explains the product value of Internet Brain OS / Hephaestus through one practical agent-failure scenario.

It is intentionally grounded in capabilities already present in the repository:

- local Hermes ingestion;
- signed HMAC boundary;
- idempotency receipts;
- replay-safe ingestion;
- bounded Hermes Agent output;
- native JSONL extraction;
- evidence-backed claim proposals;
- Kernel-owned validation, contradiction, admission, and durable memory boundaries.

It does not claim that Internet Brain OS already has every future UI, dashboard, or production connector.

## The old world: logs after damage

A normal autonomous-agent stack often gives an operator this after a bad run:

```text
[10:00:00] agent started
[10:00:02] tool called
[10:00:04] memory updated
[10:00:05] task completed
```

The logs may say what happened, but they do not answer the forensic questions:

- Which claim did the agent believe?
- Which evidence supported it?
- Was the evidence verified?
- Did another memory contradict it?
- Did the agent reuse an idempotency key for a different semantic payload?
- Did the agent attempt to submit validation or durable memory directly?
- Which preventive rule would have blocked the failure?

That gap is where unsafe autonomy becomes expensive.

## The incident

A Hermes-like agent receives a task:

```text
Find a supplier, summarize the opportunity, and remember the conclusion for future sourcing runs.
```

During the run, the agent finds one weak source and proposes this claim:

```text
Supplier X is verified and safe to use for future procurement.
```

In a weak system, the agent may immediately write that into memory.

That creates memory pollution:

```text
future decisions trust a conclusion that was never validated
```

The failure is no longer only one bad run. The failure becomes institutional memory.

## The Internet Brain OS path

Internet Brain OS treats the run as a forensic case, not a log stream.

The agent can submit operational output:

```text
run_started
evidence_recorded
claim_proposed
run_completed
```

But it cannot submit Kernel authority fields:

```text
validation
contradiction
admission
candidate
durableClaim
knowledgeAdmission
```

Those stages remain owned by the Kernel.

## What Hermes is allowed to say

Hermes may say:

```json
{
  "runId": "supplier-run-001",
  "missionId": "mission-sourcing-001",
  "taskId": "task-verify-supplier-x",
  "startedAt": "2026-07-20T00:00:00.000Z",
  "completedAt": "2026-07-20T00:00:05.000Z",
  "summary": "Hermes completed a supplier verification run.",
  "evidence": [
    {
      "id": "evidence-supplier-x-page",
      "requirementKey": "source",
      "verified": false,
      "recordedAt": "2026-07-20T00:00:02.000Z"
    }
  ],
  "claim": {
    "id": "proposal-supplier-x-safe",
    "statement": "Supplier X appears safe to use for future procurement.",
    "confidence": 0.61,
    "evidenceIds": ["evidence-supplier-x-page"],
    "proposedAt": "2026-07-20T00:00:04.000Z"
  }
}
```

Hermes may propose. Hermes may not admit.

## The secured local boundary

The run enters Internet Brain OS through the signed local ingestion boundary:

```text
POST /hermes/ingestions
```

Required protections:

- loopback-only server path;
- `IBOS_HERMES_SECRET` / `HEPHAESTUS_HERMES_SECRET` required;
- HMAC-SHA256 signature over timestamp, idempotency key, and raw body;
- request timestamp freshness;
- bounded payload size;
- idempotency receipt storage;
- replay protection.

This matters because an agent should not be able to mutate the evidence trail or replay a different semantic payload under the same key.

## Replay versus attack

A safe replay is allowed:

```text
same idempotency key + same payload = accepted replay
```

A semantic change is rejected:

```text
same idempotency key + changed claim/confidence/evidence = 409 conflict
```

That is not just API hygiene. It preserves forensic integrity.

## The forensic record

The Kernel converts the run into a cognitive pipeline record.

The record gives reviewers a better investigation surface:

```text
Mission
↓
Task
↓
Evidence
↓
Claim proposal
↓
Validation gate
↓
Contradiction check
↓
Knowledge admission decision
↓
Durable memory only if allowed
```

Instead of asking, "What line in the logs explains this?", the operator asks:

```text
What claim was proposed?
What evidence supported it?
Was the evidence verified?
Did replay protection hold?
Did the agent try to bypass Kernel authority?
Would this be admitted to memory?
```

## What gets prevented

This architecture blocks several common autonomy failures:

### 1. Direct memory pollution

The agent cannot write durable memory directly.

### 2. Fake authority

The agent cannot submit `validation`, `admission`, `contradiction`, or `durableClaim` as if those decisions were its own.

### 3. Replay mutation

A repeated request must match the original semantic payload.

### 4. Evidence laundering

A claim must reference known evidence IDs.

### 5. Invisible operational drift

The run is preserved as an inspectable cognitive pipeline record rather than disappearing as plain logs.

## Why this is AI Forensics

Observability asks:

```text
What happened?
```

AI Forensics asks:

```text
What did the agent believe?
Why did it believe it?
What evidence proves it?
What contradicted it?
Which guard stopped it?
What rule prevents it next time?
```

That is the category Internet Brain OS is moving toward.

## Demo path

Use the repository demo path to reproduce the current implemented layer:

```bash
pnpm install
pnpm build
pnpm hermes:smoke
pnpm hermes:attack-smoke
pnpm hermes:validate-agent examples/hermes-agent-run-output.sample.json
pnpm hermes:validate-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

For local signed ingestion:

```bash
IBOS_HERMES_SECRET=dev-demo-secret pnpm kernel:serve
```

Then, in a second shell:

```bash
IBOS_HERMES_SECRET=dev-demo-secret \
IBOS_HERMES_IDEMPOTENCY_KEY=demo-case-study-001 \
pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
```

Expected safe behavior:

- valid payload returns `202 Accepted`;
- exact replay returns the same record id;
- altered replay returns `409 HERMES_IDEMPOTENCY_CONFLICT`;
- authority-field injection fails before Kernel processing.

## Product takeaway

Internet Brain OS is not trying to be another dashboard of agent traces.

The goal is a forensic operating system for autonomous AI work:

```text
Cases, Evidence, Causality, Autopsy, Prevention, and Durable Memory Safety.
```

The current Hermes ingestion work is the first hardened bridge into that operating system.
