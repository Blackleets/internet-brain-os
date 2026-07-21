# Hermes Real Runtime Validation

This guide is the operational checklist for validating Internet Brain OS ingestion with real Hermes runtime output.

Related issue: #57 `Validate Hermes ingestion with real runtime output`.

## Objective

Prove that a real Hermes run can move through the secured Internet Brain OS path without bypassing Kernel authority:

```text
Hermes runtime output
→ bounded JSON export or native JSONL log
→ HermesAgentOutputAdapter / HermesNativeLogExtractor
→ signed /hermes/ingestions
→ idempotent Kernel ingestion
→ cognitive pipeline record
→ replay-safe receipt
```

Hermes may provide operational events, evidence references, claim proposals, and optional comparisons. Hermes must not provide validation, contradiction, admission, candidates, durable claims, or memory writes.

## Prerequisites

Run from a clean repository checkout:

```bash
pnpm install
pnpm build
pnpm test
```

Use a local-only secret for the validation session:

```bash
export IBOS_HERMES_SECRET="dev-real-hermes-secret"
```

Start the local Kernel server:

```bash
IBOS_HERMES_SECRET="$IBOS_HERMES_SECRET" pnpm kernel:serve
```

Keep that shell open.

## Step 1 — Baseline signed path

In a second shell, confirm the existing sample path still works:

```bash
pnpm hermes:smoke
pnpm hermes:attack-smoke
```

Expected output includes:

```text
Hermes smoke test PASS
Hermes idempotency attack test PASS
```

Do not proceed to real Hermes output until both pass locally.

## Step 2 — Capture real Hermes output

Capture one completed real Hermes run into one of these formats.

### Preferred bounded JSON export

Save as `tmp/hermes-real-run-output.json`:

```json
{
  "runId": "real-hermes-run-001",
  "missionId": "mission-real-hermes-001",
  "taskId": "task-real-hermes-001",
  "startedAt": "2026-07-20T00:00:00.000Z",
  "completedAt": "2026-07-20T00:00:05.000Z",
  "summary": "Hermes completed a real runtime task.",
  "evidence": [
    {
      "id": "evidence-real-hermes-1",
      "requirementKey": "source",
      "verified": true,
      "recordedAt": "2026-07-20T00:00:02.000Z"
    }
  ],
  "claim": {
    "id": "proposal-real-hermes-1",
    "statement": "Hermes produced a real evidence-backed operational claim.",
    "confidence": 0.9,
    "evidenceIds": ["evidence-real-hermes-1"],
    "proposedAt": "2026-07-20T00:00:04.000Z"
  }
}
```

### Native JSONL log

Save as `tmp/hermes-real-native.jsonl`:

```jsonl
{"type":"run_started","runId":"real-hermes-run-001","missionId":"mission-real-hermes-001","taskId":"task-real-hermes-001","at":"2026-07-20T00:00:00.000Z"}
{"type":"evidence","id":"evidence-real-hermes-1","requirementKey":"source","verified":true,"at":"2026-07-20T00:00:02.000Z"}
{"type":"claim","id":"proposal-real-hermes-1","statement":"Hermes produced a real evidence-backed operational claim.","confidence":0.9,"evidenceIds":["evidence-real-hermes-1"],"at":"2026-07-20T00:00:04.000Z"}
{"type":"run_completed","summary":"Hermes completed a real runtime task.","at":"2026-07-20T00:00:05.000Z"}
```

## Step 3 — Run the sensitive-data preflight

Inspect the sanitized copy before validation or sharing:

```bash
pnpm hermes:scan-sensitive tmp/hermes-real-run-output.json
# or
pnpm hermes:scan-sensitive tmp/hermes-real-native.jsonl
```

Expected output:

```text
Hermes sensitive-data preflight PASS
```

The preflight is deliberately read-only. It never rewrites the capture and never prints matched values. If it reports a finding, replace the sensitive value in a copy of the capture and rerun it. A passing scan reduces accidental exposure risk but does not replace human review.

## Step 4 — Validate captured output offline

Validate the file before sending it to the local Kernel server.

For bounded JSON:

```bash
pnpm hermes:validate-agent tmp/hermes-real-run-output.json
```

For native JSONL:

```bash
pnpm hermes:validate-agent --native-jsonl tmp/hermes-real-native.jsonl
```

Expected output:

```text
Hermes Agent output validation PASS
```

Use `--json` when another tool or script needs machine-readable validation output:

```bash
pnpm hermes:validate-agent --json tmp/hermes-real-run-output.json
pnpm hermes:validate-agent --json --native-jsonl tmp/hermes-real-native.jsonl
```

The offline validator must fail before transport if the file has invalid JSON/JSONL, missing evidence, unknown evidence references, or forbidden Kernel authority fields.

## Step 5 — Ingest real bounded JSON

```bash
IBOS_HERMES_SECRET="$IBOS_HERMES_SECRET" \
IBOS_HERMES_IDEMPOTENCY_KEY="real-hermes-run-001" \
pnpm hermes:ingest-agent tmp/hermes-real-run-output.json
```

Expected response:

```text
202 Accepted
```

The response body must include:

- `ok: true`
- a stable `recordId`
- `validationDecision`
- `recordedAt`

## Step 6 — Ingest real native JSONL

Use this only if the captured output is JSONL:

```bash
IBOS_HERMES_SECRET="$IBOS_HERMES_SECRET" \
IBOS_HERMES_IDEMPOTENCY_KEY="real-hermes-native-001" \
pnpm hermes:ingest-agent --native-jsonl tmp/hermes-real-native.jsonl
```

Expected response:

```text
202 Accepted
```

## Step 7 — Replay validation

Run the exact same command again with the exact same file and the exact same `IBOS_HERMES_IDEMPOTENCY_KEY`.

Expected behavior:

```text
202 Accepted
same recordId as first ingestion
```

Replay must not re-run validation, contradiction, admission, or storage.

## Step 8 — Attack validation

Copy the real file and alter the claim statement, confidence, evidence list, or timestamps while keeping the same idempotency key.

Example:

```bash
cp tmp/hermes-real-run-output.json tmp/hermes-real-run-output-altered.json
```

Edit `tmp/hermes-real-run-output-altered.json`, then run:

```bash
IBOS_HERMES_SECRET="$IBOS_HERMES_SECRET" \
IBOS_HERMES_IDEMPOTENCY_KEY="real-hermes-run-001" \
pnpm hermes:ingest-agent tmp/hermes-real-run-output-altered.json
```

Expected behavior:

```text
409 Conflict
HERMES_IDEMPOTENCY_CONFLICT
```

This proves the same idempotency key cannot be reused for a different semantic run.

## Step 9 — Authority-field validation

Add any forbidden field to the captured output, such as:

```json
{
  "validation": { "decision": "accepted" }
}
```

Expected behavior:

```text
pnpm hermes:validate-agent tmp/hermes-real-run-output.json
# fails before transport or ingestion
```

Forbidden Kernel authority fields include:

- `candidate`
- `validation`
- `contradiction`
- `admission`
- `claimValidation`
- `durableClaim`
- `knowledgeAdmission`

## PASS criteria

Mark Issue #57 complete only when all are true:

- `pnpm hermes:smoke` passes locally.
- `pnpm hermes:attack-smoke` passes locally.
- One real Hermes bounded JSON or JSONL output is captured.
- `pnpm hermes:scan-sensitive` passes on the sanitized copy and a human confirms no private data remains.
- `pnpm hermes:validate-agent` passes on the captured output.
- First ingestion returns `202`.
- Exact replay returns `202` with the same record id.
- Altered replay returns `409`.
- Authority-field injection fails before Kernel processing.
- No non-loopback server binding is used.
- No secrets are committed.

## If real Hermes output differs

Do not weaken the Kernel contract.

Instead:

1. save a sanitized example of the real output under `examples/`;
2. create a thin extractor that maps that output into bounded JSON or native JSONL;
3. add tests for valid extraction, authority-field rejection, and unknown evidence references;
4. keep the extractor dumb: no inferred claims, no fabricated evidence, no Kernel authority decisions.
