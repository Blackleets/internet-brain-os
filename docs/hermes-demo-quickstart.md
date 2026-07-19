# Hermes Demo Quickstart

This guide is the fastest safe demo path for proving the Hermes → Hephaestus / Internet Brain OS ingestion loop.

It is designed for demos, reviewers, contributors, and future agents that need to understand the system quickly without weakening the Kernel contract.

## What this demo proves

```text
Hermes-style agent output
→ offline validation
→ signed local ingestion
→ idempotent Kernel processing
→ replay-safe cognitive record
→ altered replay blocked
```

This is not a logging demo. It proves the AI Forensics boundary:

- Hermes can submit operational evidence and a claim proposal.
- The Kernel owns validation, contradiction, admission, memory, persistence, and recovery.
- A repeated request is replay-safe.
- A changed request using the same idempotency key is rejected.

## Prerequisites

```bash
pnpm install
pnpm build
```

## 1. Run the baseline smoke demo

```bash
pnpm hermes:smoke
```

Expected:

```text
Hermes smoke test PASS
```

This starts a temporary local Kernel, sends a signed Hermes sample payload, retries the exact same idempotency key, and verifies the same cognitive record is returned.

## 2. Run the idempotency attack demo

```bash
pnpm hermes:attack-smoke
```

Expected:

```text
Hermes idempotency attack test PASS
```

This proves:

```text
same key + same payload = replay OK
same key + altered payload = 409 conflict
```

## 3. Validate bounded Hermes output offline

```bash
pnpm hermes:validate-agent examples/hermes-agent-run-output.sample.json
```

Expected output includes:

```text
Hermes Agent output valid
```

This does not need a server or secret. It checks whether the file can be converted into Kernel ingestion events.

## 4. Validate native JSONL offline

```bash
pnpm hermes:validate-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

Expected output includes:

```text
Hermes Agent output valid
```

Use this path when Hermes emits explicit JSONL operational events instead of a bounded JSON export.

## 5. Start the real local Kernel route

Use a demo secret in one terminal:

```bash
IBOS_HERMES_SECRET=dev-demo-secret pnpm kernel:serve
```

The Hermes ingestion route is disabled unless `IBOS_HERMES_SECRET` or `HEPHAESTUS_HERMES_SECRET` is set.

## 6. Ingest bounded output into the local Kernel

In a second terminal:

```bash
IBOS_HERMES_SECRET=dev-demo-secret \
IBOS_HERMES_IDEMPOTENCY_KEY=demo-hermes-bounded-001 \
pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
```

Expected:

```text
202 Accepted
```

Run the same command again. Expected:

```text
202 Accepted
same record id
```

## 7. Ingest native JSONL into the local Kernel

```bash
IBOS_HERMES_SECRET=dev-demo-secret \
IBOS_HERMES_IDEMPOTENCY_KEY=demo-hermes-jsonl-001 \
pnpm hermes:ingest-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

Expected:

```text
202 Accepted
```

Run the same command again to verify replay safety.

## 8. Demo failure modes

### Missing secret

```bash
pnpm hermes:ingest-agent examples/hermes-agent-run-output.sample.json
```

Expected:

```text
Missing IBOS_HERMES_SECRET or HEPHAESTUS_HERMES_SECRET.
```

### Bad output shape

Add a forbidden Kernel-owned field such as `validation`, `contradiction`, `admission`, `candidate`, `durableClaim`, or `knowledgeAdmission` to a copy of the sample file, then run:

```bash
pnpm hermes:validate-agent tmp/bad-hermes-output.json
```

Expected: validation fails before any network request.

## Demo talk track

Use this when explaining the project:

```text
Hephaestus / Internet Brain OS is an AI Forensics Kernel for autonomous agents.
Hermes can report what happened, what evidence it saw, and what claim it proposes.
The Kernel decides whether that claim survives validation, contradiction checks, and admission into durable memory.
The same run can be replayed safely, but a mutated run cannot reuse the same idempotency key.
This prevents agents from silently rewriting history or poisoning memory.
```

## PASS criteria

A clean demo passes when all of these work:

- `pnpm build`
- `pnpm hermes:smoke`
- `pnpm hermes:attack-smoke`
- `pnpm hermes:validate-agent examples/hermes-agent-run-output.sample.json`
- `pnpm hermes:validate-agent --native-jsonl examples/hermes-native-log.sample.jsonl`
- bounded ingestion returns `202 Accepted`
- native JSONL ingestion returns `202 Accepted`
- exact replay returns the same record id
- altered replay returns `409 Conflict`

## What this demo does not prove yet

This demo uses representative Hermes-shaped fixtures.

Issue #57 remains the real validation gate for an actual Hermes runtime output captured from console, Telegram, or another runtime source.

If real Hermes output differs, add a tested thin extractor. Do not weaken the Kernel contract.
