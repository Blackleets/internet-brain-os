# Product Star Roadmap

This document turns the current Hermes → Kernel foundation into an execution checklist for making Internet Brain OS / Hephaestus feel like a product, not only a secure backend.

The goal is not to add random features. The goal is to make the implemented AI Forensics loop visible, trustworthy, and easy to demonstrate.

## Current foundation

Already implemented and merged:

- Signed local Hermes ingestion boundary.
- Loopback-only local Kernel route.
- HMAC headers and body binding.
- Idempotency receipts.
- Replay-safe ingestion.
- Conflict rejection for altered payloads using the same idempotency key.
- Interrupted ingestion recovery.
- Startup reconciliation.
- Bounded Hermes Agent output adapter.
- Native JSONL extractor.
- Agent-output ingestion CLI.
- Offline agent-output validator.
- Smoke and attack smoke tests.
- Demo quickstart.
- Real Hermes validation guide.
- Product-facing AI Forensics case study.
- Replay Lab contract.

Current status:

```text
Secure demo-capable foundation: strong.
Product experience: still early.
```

## North star

A reviewer should understand the product in five minutes and run a safe demo in ten minutes.

The ideal experience:

```text
clone repo
→ run demo commands
→ see a forensic case created
→ inspect evidence and claim proposal
→ replay the same run safely
→ alter the run and see conflict rejection
→ understand why this prevents contaminated memory
```

## Phase A — Real Hermes validation

Purpose: prove this is not synthetic-only.

Checklist:

- [ ] Capture one real Hermes runtime output.
- [ ] Redact secrets and private data.
- [ ] Validate it with `pnpm hermes:validate-agent` or `--native-jsonl`.
- [ ] Ingest it through `/hermes/ingestions`.
- [ ] Confirm exact replay returns the same record id.
- [ ] Confirm altered replay returns `409 HERMES_IDEMPOTENCY_CONFLICT`.
- [ ] Confirm forbidden Kernel authority fields fail before ingestion.
- [ ] Close Issue #57 only after the above is proven.

If Hermes emits an unsupported structure:

- [ ] Save a sanitized fixture under `examples/`.
- [ ] Add a thin extractor.
- [ ] Add tests for valid extraction.
- [ ] Add tests for authority-field rejection.
- [ ] Add tests for unknown evidence references.

Do not weaken the Kernel contract to make real Hermes fit.

## Phase B — Visible Replay Lab

Purpose: make the forensic record understandable without reading JSON.

Primary contract:

- `docs/replay-lab-contract.md`

Minimum UI should show:

- [ ] Case / cognitive record id.
- [ ] Mission id.
- [ ] Task id.
- [ ] Timeline of Hermes events.
- [ ] Evidence records.
- [ ] Claim proposal.
- [ ] Validation/admission state owned by Kernel.
- [ ] Idempotency receipt status.
- [ ] Replay result: original, exact replay, or conflict.
- [ ] Blocked authority fields if present.

Design principle:

```text
Do not show logs first. Show the investigation first.
```

Suggested product labels:

- Case
- Evidence
- Claim Proposal
- Replay
- Conflict
- Prevention Rule
- Kernel Decision

## Phase C — Operator demo mode

Purpose: make demos repeatable and safe.

Checklist:

- [ ] Add a local-only demo command or documented two-terminal flow.
- [ ] Seed a known sample case.
- [ ] Show safe replay.
- [ ] Show altered replay blocked.
- [ ] Show authority injection blocked.
- [ ] Keep secrets out of commits and output.
- [ ] Ensure demo works without external paid APIs.

Potential command shape:

```bash
pnpm demo:hermes-forensics
```

Do not add this until the command can manage local server lifecycle safely.

## Phase D — Product narrative polish

Purpose: make the repo understandable to users, contributors, and investors.

Checklist:

- [ ] Improve README first screen.
- [ ] Add a simple architecture diagram in Markdown.
- [ ] Add a short “What this is / What this is not” section.
- [ ] Add a one-minute demo script.
- [ ] Add screenshots once UI exists.
- [ ] Add a short X/Twitter launch post draft.
- [ ] Add a founder-facing pitch paragraph.

Core message:

```text
Internet Brain OS is an AI Forensics and memory-safety layer for autonomous agents.
It turns agent runs into evidence-backed cases before anything becomes durable memory.
```

## Phase E — Kernel memory safety expansion

Purpose: move from ingestion safety to long-term cognitive safety.

Checklist:

- [ ] Add clearer memory admission reports.
- [ ] Add contradiction summaries.
- [ ] Add prevention-rule proposals from repeated failures.
- [ ] Add toxic-memory flags.
- [ ] Add reversible memory writes or quarantine state.
- [ ] Add explicit “why this was not admitted” explanations.

Invariant:

```text
Hermes proposes. Kernel verifies. Contradiction checks. Admission decides. Memory persists only after gates pass.
```

## Phase F — Packaging and release readiness

Purpose: make external review safe.

Checklist:

- [ ] Confirm `pnpm install`, `pnpm build`, `pnpm test` pass from clean clone.
- [ ] Confirm demo commands pass from clean clone.
- [ ] Remove or document stale references.
- [ ] Check docs for overclaiming.
- [ ] Check all public examples are sanitized.
- [ ] Confirm no secrets in repo.
- [ ] Confirm local server does not bind publicly.
- [ ] Tag a pre-alpha release only when demo and docs are coherent.

## What not to do

Do not:

- Turn the project back into a generic observability dashboard.
- Allow Hermes or any external agent to write durable memory directly.
- Accept validation/admission fields from agent output.
- Add network-exposed ingestion routes without a new security design.
- Add UI that shows pretty logs but hides forensic causality.
- Add broad dependencies before the local-first foundation is stable.

## Recommended next PRs

1. Real Hermes runtime fixture or extractor.
2. Replay Lab read model / API for displaying forensic records.
3. Minimal local dashboard screen for one ingested case.
4. Demo screenshots and README visual polish.
5. Memory quarantine / prevention-rule design note.

## Definition of “project star”

The project becomes a star when it can prove this loop end to end:

```text
An autonomous agent produced a risky run.
Internet Brain OS captured it as a case.
The system preserved evidence.
The Kernel blocked forged authority.
Replay was safe.
Altered replay was rejected.
Memory admission remained controlled.
The operator could understand what happened and what rule prevents recurrence.
```
