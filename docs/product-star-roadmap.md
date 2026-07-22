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

Status legend for the execution sections below:

- `[x]` verified in the repository and current validation baseline.
- `[ ]` not yet proven or intentionally deferred.
- A phase is complete only when every required item is checked; partial implementation is stated explicitly.

## North star

A user should install Efesto, authorize a public site, and see useful opportunity Evidence reach their private local intelligence system without handling JSON or opening Replay Lab.

The primary experience is now:

```text
user browses an authorized public site
→ Efesto captures safely in the background
→ local Kernel preserves Evidence and provenance
→ local model classifies useful opportunities
→ Hermes or another connected agent investigates promising findings
→ Obsidian receives curated knowledge
→ Replay Lab explains decisions only when advanced detail is needed
```

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

Status: **blocked on one sanitized output from the user's real Hermes runtime**. Synthetic fixtures and smoke tests do not complete this phase.

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

Status: **complete for the current read-only operator scope**.

Primary contract:

- `docs/replay-lab-contract.md`

Minimum UI should show:

- [x] Case / cognitive record id.
- [x] Mission id.
- [x] Task id.
- [x] Timeline of Hermes events.
- [x] Evidence records.
- [x] Claim proposal.
- [x] Validation/admission state owned by Kernel.
- [x] Idempotency receipt status.
- [x] Replay result derived from the persisted receipt state.
- [x] Authority boundary status and forbidden fields, with an honest non-persistence explanation for rejected attempts.
- [x] Deterministic Causality Map derived only from persisted evidence, claim, gate, contradiction, and admission links.
- [x] Evidence-backed AI Autopsy separating observed facts from deterministic interpretation.
- [x] Read-only Prevention Rule proposals that require human approval and never mutate Kernel policy.

Evidence: `ReplayLabQueryService`, the authenticated read-only `/api/replay-lab/*` API, `apps/local-kernel/replay-lab-page.mjs`, read-model/API coverage, the explicit pre-ingestion authority-boundary projection, persisted-record-only causality edges, deterministic autopsy findings, and non-enforced prevention proposals.

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

Status: **complete through the documented local flow and deterministic smoke commands**.

Checklist:

- [x] Add a local-only demo command or documented two-terminal flow.
- [x] Seed a known sample case.
- [x] Show safe replay.
- [x] Show altered replay blocked.
- [x] Show authority injection blocked.
- [x] Keep secrets out of commits and output.
- [x] Ensure demo works without external paid APIs.

Evidence: `docs/hermes-demo-quickstart.md`, `pnpm hermes:smoke`, `pnpm hermes:attack-smoke`, both sanitized fixtures under `examples/`, and offline authority-field rejection in the Hermes output adapters.

Potential command shape:

```bash
pnpm demo:hermes-forensics
```

Do not add this until the command can manage local server lifecycle safely.

## Phase D — Product narrative polish

Purpose: make the repo understandable to users, contributors, and investors.

Status: **narrative package complete; real interface screenshots remain**.

Checklist:

- [x] Improve README first screen.
- [x] Add a simple architecture diagram in Markdown.
- [x] Add a short “What this is / What this is not” section.
- [x] Add a one-minute demo script.
- [ ] Add screenshots once UI exists.
- [x] Add a short X/Twitter launch post draft.
- [x] Add a founder-facing pitch paragraph.

Evidence: the README product opening and architecture view plus `docs/launch-kit.md`. Screenshots must depict the real local interface and must not be replaced with generated mockups presented as product evidence.

Core message:

```text
Internet Brain OS is an AI Forensics and memory-safety layer for autonomous agents.
It turns agent runs into evidence-backed cases before anything becomes durable memory.
```

## Phase E — Kernel memory safety expansion

Purpose: move from ingestion safety to long-term cognitive safety.

Status: **not started as a dedicated expansion phase**. Existing validation, contradiction, and admission primitives are the foundation, not completion of these operator-facing capabilities.

Checklist:

- [ ] Add clearer memory admission reports.
- [ ] Add contradiction summaries.
- [x] Add conservative prevention-rule proposals from recorded forensic outcomes. Repeated-failure aggregation remains future work.
- [ ] Add toxic-memory flags.
- [ ] Add reversible memory writes or quarantine state.
- [x] Add explicit “why this was not admitted” explanations in AI Autopsy.

Invariant:

```text
Hermes proposes. Kernel verifies. Contradiction checks. Admission decides. Memory persists only after gates pass.
```

## Phase F — Packaging and release readiness

Purpose: make external review safe.

Status: **local validation passes** with 58 test files / 290 tests plus typecheck and build. The forensic UI and authenticated real-capture importer are merged; the Efesto automatic browser radar is implemented locally and awaits review/CI. A real Hermes proof remains required before a pre-alpha tag.

## Phase G — Efesto Opportunity Radar

Purpose: restore the original product promise: navigate normally while Efesto finds and preserves useful public information in parallel.

- [x] Redesign the extension as the primary Efesto surface.
- [x] Require explicit authorization per public origin.
- [x] Automatically block sensitive routes, query keys, selections, and rapid repeat captures.
- [x] Keep every automatic capture inside the user's loopback Kernel and Obsidian destination.
- [x] Show truthful readiness for Kernel, Hermes, local model, and Obsidian.
- [ ] Classify opportunities and suppress ordinary low-value pages.
- [ ] Add a simple Opportunity inbox and notifications.
- [ ] Add one-click Agent Hub onboarding, beginning with Hermes.
- [ ] Add guided Model Forge setup for audited local models.
- [ ] Specify opt-in collective signals without transferring private browsing or vault content.

Checklist:

- [x] Confirm `pnpm install --frozen-lockfile` and `pnpm verify:first-run` pass from a clean Git clone.
- [x] Confirm demo commands pass from clean clone.
- [ ] Remove or document stale references.
- [ ] Check docs for overclaiming.
- [x] Check all public Hermes examples pass the sensitive-data preflight.
- [x] Confirm tracked secret-pattern matches are limited to deliberate negative-test fixtures.
- [x] Confirm local server rejects non-loopback hosts before binding publicly.
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

1. Real Hermes runtime fixture or thin extractor, once the external capture is available.
2. Capture sanitized screenshots from the real local Replay Lab interface.
3. Memory quarantine / prevention-rule design note.
4. Clean-clone packaging and release-readiness audit.

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
