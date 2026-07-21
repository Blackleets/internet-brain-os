# Replay Lab Local Read API

Replay Lab exposes a local, authenticated, read-only API for inspecting forensic case projections.

This API is not an ingestion path. Hermes output must still enter through `/hermes/ingestions`.

## Security model

Replay Lab API routes live under `/api/*`, so they use the existing local Kernel token guard.

Required header:

```http
x-hephaestus-token: <local-api-token>
```

The API must not expose:

- HMAC secrets;
- request signatures;
- raw authorization headers;
- Hermes request fingerprints;
- private local filesystem paths;
- raw payloads unless a future endpoint explicitly marks them as sanitized evidence.

## Availability

Replay Lab is available when Hermes local ingestion is configured with a secret and the Kernel package has been built.

Start local Kernel with Hermes enabled:

```bash
pnpm build
IBOS_HERMES_SECRET=dev-demo-secret pnpm kernel:serve
```

Check health:

```bash
curl -s http://127.0.0.1:4000/health | jq
```

Expected capability flags:

```json
{
  "ok": true,
  "service": "hephaestus-local-kernel",
  "hermes": true,
  "replayLab": true
}
```

If Hermes is not configured, Replay Lab returns `REPLAY_LAB_UNAVAILABLE`.

## List cases

```http
GET /api/replay-lab/cases
```

Example:

```bash
curl -s \
  -H "x-hephaestus-token: $HEPHAESTUS_API_TOKEN" \
  http://127.0.0.1:4000/api/replay-lab/cases | jq
```

Response shape:

```json
{
  "ok": true,
  "cases": [
    {
      "id": "pipeline-record-id",
      "missionId": "mission-id",
      "taskId": "task-id",
      "recordedAt": "2026-07-20T00:00:00.000Z",
      "status": "admitted",
      "timeline": [],
      "evidence": [],
      "claimProposal": {},
      "gates": {},
      "idempotency": {
        "status": "attached",
        "idempotencyKey": "demo-hermes-bounded-001",
        "recordMatchesReceipt": true
      },
      "warnings": []
    }
  ]
}
```

Cases are sorted newest-first by `recordedAt`.

## Get one case

```http
GET /api/replay-lab/cases/:id
```

The `:id` segment must be URL-encoded.

Example:

```bash
CASE_ID="pipeline-record-id"
curl -s \
  -H "x-hephaestus-token: $HEPHAESTUS_API_TOKEN" \
  "http://127.0.0.1:4000/api/replay-lab/cases/$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$CASE_ID")" | jq
```

Response shape:

```json
{
  "ok": true,
  "case": {
    "id": "pipeline-record-id",
    "missionId": "mission-id",
    "taskId": "task-id",
    "status": "admitted"
  }
}
```

## Error responses

### Missing or invalid token

```json
{
  "ok": false,
  "code": "AUTH_REQUIRED"
}
```

### Replay Lab disabled

```json
{
  "ok": false,
  "code": "REPLAY_LAB_UNAVAILABLE"
}
```

### Unknown route

```json
{
  "ok": false,
  "code": "NOT_FOUND"
}
```

### Internal read failure

```json
{
  "ok": false,
  "code": "REPLAY_LAB_READ_FAILED"
}
```

## Manual validation flow

1. Start local Kernel with Hermes enabled.
2. Run a Hermes sample ingestion.
3. List Replay Lab cases.
4. Fetch the returned case id.
5. Confirm the view shows:
   - timeline;
   - evidence ids;
   - claim proposal;
   - validation / contradiction / admission gates;
   - idempotency receipt metadata;
   - warnings for missing or mismatched state.

Sample ingestion:

```bash
IBOS_HERMES_SECRET=dev-demo-secret \
IBOS_HERMES_IDEMPOTENCY_KEY=demo-replay-lab-api-001 \
pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
```

## Non-goals

The API does not:

- ingest Hermes payloads;
- mutate receipts;
- write durable memory;
- retry failed ingestion;
- mark a case reviewed;
- generate reports;
- expose raw private payloads.

Those actions require separate design and security review.
