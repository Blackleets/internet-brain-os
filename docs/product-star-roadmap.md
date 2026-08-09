# Product Star Roadmap

This roadmap turns the verified HEPHAESTUS / Efesto foundation into a focused release and product plan. It must follow `PROJECT_STATE.md` and live CI when newer than this file.

The goal is not to add random features. The goal is to make the evidence-first intelligence loop useful, trustworthy, easy to install, measurable, and easy to demonstrate without weakening Kernel authority.

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
- Frozen-lockfile install, provider-neutral architecture guard, production dependency audit, typecheck, Vitest, build, first-run verification, Chromium acceptance and Windows smoke/reproduction gates.
- Exact packaged-candidate qualification is a required release-control layer before manual UAT.

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

Status: **complete**.

## Phase B — Replay Lab

Status: **complete for the current read-only operator scope**.

## Phase C — Goal-first product experience

Status: **implemented and browser-tested**.

## Phase D — Opportunity intelligence

Status: **MVP loop implemented**.

Remaining long-term items:

- [ ] Broader connector catalog beyond current MVP boundaries.
- [ ] Opt-in collective signals/privacy design for future network effects.

## Phase E — Memory-safety expansion

Purpose: complete the advanced operator/safety layer without turning agents into the Kernel.

Status: **active bounded engineering phase**.

Already present:

- [x] Kernel-owned contradiction/admission explanations.
- [x] Durable authority receipts and restart reconciliation.
- [x] Conservative prevention proposals from forensic outcomes.
- [x] Retrieval reuse gate that only admits reconciled `admitted` memory.
- [x] Fail-closed lifecycle/transition authorization.
- [x] Provider-neutral architecture guard on protected authority modules.
- [x] #185 — deterministic quarantine-signal evaluation and read-only recommendation identity.
- [x] #187 — append-only in-memory + durable quarantine recommendation persistence, integrity reconstruction, exact replay and explicit fresh/stale assessment without transition authority.

Next sequence:

- [ ] #188 — Explicit terminal-memory recovery review records with founder/policy approval requirements.
- [ ] #189 — Repeated-failure aggregation into read-only prevention recommendations.
- [ ] #190 — Replay Lab/operator read model for these recommendations with provenance and no mutation authority.
- [ ] #191 — Contract freeze with full unit, negative, replay, corruption, Gherkin and integration/adversarial coverage.

## Phase F — Distribution and release closeout

Status: **automated qualification implemented; immutable candidate advances whenever code changes**.

- [x] Non-technical Windows setup and self-healing launcher.
- [x] Immutable internal packaging with SHA-256 + BUILD_INFO binding.
- [x] Exact-ZIP fresh-install + paired-repair qualification on Windows 2022 and Windows 2025.
- [x] Strict production dependency audit and release contracts.
- [x] `0.1.0-internal.6` preserved as prior runtime-readiness candidate.
- [x] `0.1.0-internal.7` through `0.1.0-internal.12` frozen after their respective qualification/supersession points.
- [ ] Qualify `0.1.0-internal.13` through architecture, CI, Chromium, Windows launcher/first-run and both exact packaged-install jobs for the final E2 SHA.
- [ ] Merge and prove the merged `main` SHA through affected gates.
- [ ] Run UAT-1 through UAT-6 only on the exact final immutable candidate chosen after affected Memory Safety work.
- [ ] Public-release PR/tag only after UAT passes and `publicLaunchApproved` is explicitly promoted.

## Enterprise measurement — Issue #186

Primary KPIs:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Repeat Goal Usage.

Drivers/guardrails include mission completion/failure rate, installation-to-first-Goal activation, Find usefulness/dismissal, notification delivery, altered-replay acceptance = 0, unauthorized memory admission = 0, credential/privacy leakage = 0, and exact packaged install/repair success.

Initial measurement remains local-first. Aggregate sharing requires a separate opt-in privacy design.

## Phase G — Product Design formalization

Status: **Issue #192 is blocked until #191 freezes Memory Safety contracts**.

The design phase must refine the existing Goal-first surface, preserve real Kernel state, and include responsive/accessibility/reduced-motion QA. No fake product state is permitted.

## Phase H — Product narrative and evidence

- [x] Clear intelligence-forge / AI-forensics narrative.
- [x] Architecture and authority-boundary documentation.
- [x] Deterministic demo quickstart and authentic-runtime acceptance evidence.
- [ ] Capture final release-candidate screenshots after the exact product candidate is frozen.
- [ ] Publish launch materials only after UAT promotion.

## What not to do

Do not:

- turn Efesto back into a generic scraper or observability dashboard;
- allow Hermes or another external agent to write durable memory directly;
- accept validation, admission or quarantine authority from agent output;
- silently rewrite stale safety recommendations;
- expose trusted Kernel routes publicly without a new security design;
- add fake UI state or motion that implies work not present in persisted/streaming state;
- reuse an internal candidate identity after behavior changes;
- start formal visual redesign while safety contracts are moving.

## Next bounded sequence

1. Merge #187 only after all architecture, CI, Chromium and exact Windows package gates are green.
2. Execute #188, #189 and #190 one bounded PR at a time.
3. Close #191 only after adversarial contract-freeze coverage is green.
4. Implement #186 local-first product measurement.
5. Begin #192 Product Design against frozen contracts.
6. Run UAT on the exact resulting immutable candidate, then decide public promotion.

## Definition of “project star”

```text
Install exact qualified package
→ Kernel proves local ownership/readiness
→ user gives Goal
→ bounded public research
→ Case + Evidence + provenance
→ Kernel validation and authority gates
→ useful Finds / notification
→ replay-safe controlled memory
→ questionable memory gets deterministic recommendation + durable review history
→ operator can understand decisions without gaining mutation authority
→ product measures whether Goals produce useful outcomes while preserving privacy
```
