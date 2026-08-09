# Product Star Roadmap

This roadmap turns the verified HEPHAESTUS / Efesto foundation into a focused release and product plan. It must follow `PROJECT_STATE.md` and live CI when newer than this file.

The goal is not to add random features. The goal is to make the evidence-first intelligence loop useful, trustworthy, easy to install, and easy to demonstrate without weakening Kernel authority.

## Current foundation — verified 2026-08-09

Implemented:

- Signed, loopback-only Hermes ingestion with HMAC binding and idempotency.
- Exact replay safety and altered-replay conflict rejection.
- Kernel-owned Evidence, contradiction, admission, authority receipts and durable-memory gates.
- Authentic Hermes runtime proof through the bounded Agent Hub boundary.
- Native public `web.search` and `web.read` through capability/risk gates.
- Goal → Evidence → Opportunity → Trigger/Notification Golden E2E.
- Opportunity classification, Goal matching, ranking, dedupe, dismissal and private preference learning.
- Replay Lab read-only forensic surface.
- Goal-first Control Center plus living Efesto forge UI.
- Browser extension workspaces for Forge, Missions, Finds and Models.
- One-click/self-healing Windows setup and immutable internal release packaging.
- Frozen-lockfile install, production dependency audit, typecheck, Vitest, build, first-run verification, Chromium acceptance and Windows smoke/reproduction gates.

Status legend:

- `[x]` verified in the repository/current baseline.
- `[ ]` intentionally deferred or still requiring proof.

## North star

A user should install Efesto, define a Goal, and receive useful public-web findings backed by local Evidence without handling JSON or giving an agent authority over trusted memory.

```text
Goal
→ authorized research
→ Case + Evidence
→ Kernel verification
→ Opportunity ranking
→ Trigger / notification
→ controlled memory only after Kernel gates
```

## Phase A — Authentic Hermes boundary

Purpose: prove the system is not synthetic-only.

Status: **complete**.

- [x] Capture and sanitize authentic Hermes runtime output.
- [x] Validate the real runtime through the bounded adapter path.
- [x] Prove exact replay idempotency.
- [x] Prove altered replay rejection.
- [x] Prove Kernel-owned authority fields cannot be injected by Hermes.
- [x] Prove the Agent Hub worker against the authentic runtime.
- [x] Close Issue #57 and Issue #101 after the acceptance evidence was recorded.

Invariant: do not weaken the Kernel contract to make an external agent fit.

## Phase B — Replay Lab

Purpose: make the forensic record understandable without reading raw logs.

Status: **complete for the current read-only operator scope**.

- [x] Case/cognitive record identity.
- [x] Evidence records and claim proposal.
- [x] Kernel validation/admission state.
- [x] Idempotency/replay state.
- [x] Authority-boundary explanation.
- [x] Deterministic causality and AI-autopsy views derived from persisted state.
- [x] Read-only prevention proposals.
- [x] No durable-memory mutation authority in Replay Lab.

## Phase C — Goal-first product experience

Purpose: expose useful intelligence rather than a generic admin/log dashboard.

Status: **implemented and browser-tested**.

- [x] Home/Goal surface.
- [x] Missions.
- [x] Finds/Opportunities.
- [x] Evidence.
- [x] Models/chat.
- [x] Agents.
- [x] Automations.
- [x] Settings.
- [x] Living Efesto pixel-smith/brain identity driven by observable state.
- [x] Mobile containment and reduced-motion behavior.
- [x] Explicit confirmation before Goal execution.

## Phase D — Opportunity intelligence

Purpose: restore the original promise: Efesto should find useful public opportunities while preserving provenance and privacy.

Status: **MVP loop implemented**.

- [x] Explicit public-origin authorization and sensitive-route protections.
- [x] Local Goal matching and relevance scoring.
- [x] Exact/fuzzy deduplication.
- [x] Kernel-owned Evidence preservation.
- [x] Opportunity ranking with provenance.
- [x] Trigger/notification path with replay-safe deduplication.
- [x] Private, erasable preference learning from explicit feedback.
- [x] Obsidian-compatible projection.
- [ ] Broader connector catalog beyond the current MVP boundaries.
- [ ] Opt-in collective signals/privacy design for future network effects.

## Phase E — Memory-safety expansion

Purpose: extend the existing authority foundation without turning agents into the Kernel.

Status: **partially implemented; advanced controls remain future work**.

- [x] Kernel-owned contradiction/admission explanations.
- [x] Durable authority receipts and restart reconciliation.
- [x] Conservative prevention proposals from forensic outcomes.
- [ ] Richer quarantine/toxic-memory operator controls.
- [ ] Reversible memory-management workflows beyond the current lifecycle gates.
- [ ] Repeated-failure aggregation for prevention-rule recommendations.

## Phase F — Distribution and release closeout

Purpose: ship an internally testable Windows candidate without confusing CI success with public approval.

Status: **current active release gate**.

- [x] Non-technical `Install Efesto.cmd` path.
- [x] Self-healing launcher prerequisites.
- [x] Immutable internal artifact packaging with SHA-256 manifest.
- [x] Production dependency audit without a GHSA ignore.
- [x] Windows launcher, first-run and pairing recovery automation.
- [x] Advance runtime-changing candidate to `0.1.0-internal.6`.
- [x] Add extension background runtime regression + Gherkin coverage.
- [ ] Full PR/main CI green for the exact `internal.6` code state.
- [ ] UAT-1 through UAT-6 on the same generated Windows artifact.
- [ ] Public-release PR/tag only after UAT passes and `publicLaunchApproved` is explicitly promoted.

## Phase G — Product narrative and evidence

Purpose: make the product understandable to users, contributors and investors without overclaiming.

- [x] Clear AI-forensics / intelligence-forge narrative.
- [x] Architecture and authority-boundary documentation.
- [x] Deterministic demo quickstart.
- [x] Authentic-runtime acceptance documented separately from fixtures.
- [x] Founder-facing launch kit.
- [ ] Capture/update real product screenshots from the exact release candidate where needed.
- [ ] Publish public launch materials only after the UAT promotion gate.

## What not to do

Do not:

- turn the project back into a generic scraper or observability dashboard;
- allow Hermes or any external agent to write durable memory directly;
- accept validation/admission authority from agent output;
- expose trusted Kernel routes publicly without a new security design;
- add fake UI state or animation that implies work not present in persisted/streaming state;
- authorize purchases, logins or form submissions as part of the current Golden path;
- reuse an internal candidate number after shipped behavior changes.

## Next bounded sequence

1. Make the `internal.6` runtime-readiness PR fully green.
2. Merge only after required CI, Chromium and affected Windows gates pass.
3. Generate the immutable `internal.6` Windows artifact from merged `main`.
4. Run UAT-1 through UAT-6 on that exact artifact.
5. If every UAT passes, create a separate public-release promotion change.
6. Then resume product expansion from real user feedback rather than adding another broad subsystem.

## Definition of “project star”

The project is a star when the user-value and safety loops are both visible:

```text
A user gives Efesto a Goal.
An agent or native capability researches bounded public sources.
The Kernel preserves Evidence and provenance.
The Kernel blocks forged authority and altered history.
Useful Opportunities are ranked and surfaced.
Exact replay is safe and side effects remain controlled.
The operator can understand why a result was trusted, rejected or retained.
```
