# Hermes → Internet Brain OS Ingestion Contract

This document defines how Hermes submits a completed execution into Internet Brain OS.

The ingestion boundary is local-first, signed, idempotent, and evidence-first. Hermes may submit execution events, evidence references, proposed claims, and contradiction comparisons. Hermes must not submit Kernel authority outputs such as validation decisions, durable claims, admission decisions, or contradiction outcomes.

## Endpoint

```http
POST /hermes/ingestions
```

Default local URL:

```text
http://127.0.0.1:4000/hermes/ingestions
```

The route is disabled unless one of these environment variables is set on the local Kernel server:

```bash
IBOS_HERMES_SECRET=...
# or
HEPHAESTUS_HERMES_SECRET=...
```

The server must still bind to loopback. Non-loopback hosts are rejected before routing.

## Required headers

```http
Content-Type: application/json
X-IBOS-Idempotency-Key: <stable unique key for the Hermes execution>
X-IBOS-Timestamp: <current ISO-8601 UTC timestamp>
X-IBOS-Signature: <hex hmac sha256 signature>
```

## Signature

Hermes signs exactly this string:

```text
<X-IBOS-Timestamp>.<X-IBOS-Idempotency-Key>.<raw request body>
```

Algorithm:

```text
HMAC-SHA256(secret, signing-string).hex()
```

The raw request body must be the exact bytes sent over HTTP. Reformatting JSON after signing invalidates the signature.

## Hermes Agent run export

When using a real Hermes Agent run, first normalize the run into this bounded export shape. This is not a Kernel record; it is only operational output from Hermes.

```json
{
  "runId": "hermes-run-2026-07-20-001",
  "missionId": "mission-hermes-real-001",
  "taskId": "task-hermes-real-001",
  "startedAt": "2026-07-20T00:00:00.000Z",
  "completedAt": "2026-07-20T00:00:03.000Z",
  "summary": "Hermes execution completed.",
  "evidence": [
    {
      "id": "evidence-hermes-real-1",
      "requirementKey": "source",
      "verified": true,
      "recordedAt": "2026-07-20T00:00:01.000Z"
    }
  ],
  "claim": {
    "id": "proposal-hermes-real-1",
    "statement": "Hermes produced an evidence-backed claim.",
    "confidence": 0.9,
    "evidenceIds": ["evidence-hermes-real-1"],
    "proposedAt": "2026-07-20T00:00:02.000Z"
  }
}
```

The Kernel adapter converts that export into `HermesExecutionEvent[]`. The adapter rejects embedded Kernel authority fields such as `validation`, `contradiction`, `admission`, `candidate`, `durableClaim`, or `knowledgeAdmission` before ingestion.

## Native Hermes JSONL log

If Hermes emits native JSONL-style operational events, use this explicit event format:

```jsonl
{"type":"run_started","runId":"hermes-native-1","missionId":"mission-native-1","taskId":"task-native-1","at":"2026-07-20T00:00:00.000Z"}
{"type":"evidence","id":"evidence-native-1","requirementKey":"source","verified":true,"at":"2026-07-20T00:00:01.000Z"}
{"type":"claim","id":"proposal-native-1","statement":"Hermes produced an evidence-backed claim.","confidence":0.9,"evidenceIds":["evidence-native-1"],"at":"2026-07-20T00:00:02.000Z"}
{"type":"run_completed","summary":"Hermes execution completed.","at":"2026-07-20T00:00:03.000Z"}
```

`HermesNativeLogExtractor` converts this JSONL into the bounded Hermes Agent run export. It is a thin extractor only: it does not infer missing claims, fabricate evidence, validate knowledge, or admit memory.

## Agent-output CLI

Build first:

```bash
pnpm build
```

Start the local Kernel with the same secret used by the client:

```bash
IBOS_HERMES_SECRET=dev-secret pnpm kernel:serve
```

In another shell, ingest a bounded Hermes Agent run export JSON:

```bash
IBOS_HERMES_SECRET=dev-secret pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
```

Or ingest a native Hermes JSONL log:

```bash
IBOS_HERMES_SECRET=dev-secret pnpm hermes:ingest-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

The CLI:

1. reads the Hermes Agent run export JSON or native JSONL log;
2. converts it through `HermesNativeLogExtractor` when `--native-jsonl` is used;
3. converts the bounded output through `HermesAgentOutputAdapter`;
4. builds the signed `/hermes/ingestions` payload;
5. sends it to the local Kernel server;
6. exits non-zero if conversion, signing, transport, or ingestion fails.

Use `IBOS_HERMES_IDEMPOTENCY_KEY`, `IBOS_HERMES_RECORD_ID`, or `IBOS_HERMES_RESULT_ID` to override derived IDs when reproducing a specific run.

## Request body

```json
{
  "idempotencyKey": "hermes-run-2026-07-20-001",
  "recordId": "pipeline-hermes-run-2026-07-20-001",
  "resultId": "result-hermes-run-2026-07-20-001",
  "events": [
    {
      "type": "run_started",
      "missionId": "mission-hermes-sample",
      "taskId": "task-hermes-sample",
      "at": "2026-07-20T00:00:00.000Z"
    },
    {
      "type": "evidence_recorded",
      "evidenceId": "evidence-hermes-sample-1",
      "requirementKey": "source",
      "verified": true,
      "at": "2026-07-20T00:00:01.000Z"
    },
    {
      "type": "claim_proposed",
      "proposalId": "proposal-hermes-sample-1",
      "statement": "Hermes produced an evidence-backed claim.",
      "confidence": 0.9,
      "evidenceIds": ["evidence-hermes-sample-1"],
      "at": "2026-07-20T00:00:02.000Z"
    },
    {
      "type": "run_completed",
      "summary": "Hermes execution completed.",
      "at": "2026-07-20T00:00:03.000Z"
    }
  ],
  "comparisons": []
}
```

## Event rules

A valid completed Hermes execution must include exactly:

- one `run_started` event;
- one `claim_proposed` event;
- one `run_completed` event;
- zero or more `evidence_recorded` events.

Additional requirements:

- event timestamps must be valid ISO-8601 UTC timestamps;
- claim confidence must be between `0` and `1`;
- every `claim_proposed.evidenceIds[]` entry must reference an evidence event in the same payload;
- evidence ids must be unique within the execution;
- header idempotency key must match body `idempotencyKey` when the body field is present.

## Idempotency behavior

The same payload with the same idempotency key may be safely retried.

Expected behavior:

```text
first request  → process and persist cognitive pipeline record
same retry     → return the original cognitive pipeline record
altered retry  → reject before Kernel gates execute again
```

The replay path must not rerun validation, contradiction, admission, or persistence.

## Authority boundary

Hermes may submit:

- execution lifecycle events;
- evidence references;
- claim proposal text and confidence;
- optional comparisons against known Kernel claims.

Hermes must not submit:

- `candidate`;
- `validation`;
- `contradiction`;
- `admission`;
- `claim`;
- `durableClaim`.

The Kernel owns:

```text
claim validation
contradiction analysis
knowledge admission
durable storage
startup recovery
idempotency receipts
```

## Smoke test

Build first:

```bash
pnpm build
```

Run the automated local smoke test:

```bash
pnpm hermes:smoke
```

Or manually run server and sample client:

```bash
IBOS_HERMES_SECRET=dev-secret pnpm kernel:serve
IBOS_HERMES_SECRET=dev-secret node scripts/hermes-ingest-sample.mjs
```

Expected smoke result:

```text
Hermes smoke test PASS
```

The smoke test verifies:

- local server starts with Hermes enabled;
- `/health` reports Hermes enabled without leaking the secret;
- a signed Hermes payload returns `202`;
- retrying the same idempotency key returns the same cognitive record id.

## Failure signals

Common expected failures:

| Failure | Meaning |
|---|---|
| `HOST_FORBIDDEN` | Request was not addressed to loopback host. |
| `UNSUPPORTED_MEDIA_TYPE` | Request did not use JSON content type. |
| `HERMES_INGESTION_REJECTED` | Signature, timestamp, idempotency, body, or local-only validation failed. |
| `HERMES_INGESTION_FAILED` | Transport was accepted but Kernel ingestion failed. |

Any `HERMES_INGESTION_FAILED` result should be treated as an operator-visible failure and investigated with the receipt and cognitive pipeline stores.
