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

Status legend:

- `[x]` implemented or contractually added in the current repository/active bounded branch.
- `[ ]` still requiring green proof or intentionally deferred.

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

Purpose: complete the advanced operator/safety layer without turning agents into the Kernel.

Status: **active bounded engineering phase**.

Already present:

- [x] Kernel-owned contradiction/admission explanations.
- [x] Durable authority receipts and restart reconciliation.
- [x] Conservative prevention proposals from forensic outcomes.
- [x] Retrieval reuse gate that only admits reconciled `admitted` memory.
- [x] Fail-closed lifecycle/transition authorization.
- [x] Provider-neutral architecture guard on protected authority modules.

Implementation sequence:

- [x] #185 — Kernel-owned quarantine-signal evaluator producing deterministic read-only recommendations from normalized persisted references; terminal states stay outside the normal quarantine graph.
- [ ] #187 — Persist/read quarantine recommendations without granting them transition authority.
- [ ] #188 — Explicit terminal-memory recovery review records with founder/policy approval requirements.
- [ ] #189 — Repeated-failure aggregation into read-only prevention recommendations.
- [ ] #190 — Replay Lab/operator read model for these recommendations with provenance and no mutation authority.
- [ ] #191 — Contract freeze with full unit, negative, replay, corruption, Gherkin and integration/adversarial coverage.

## Phase F — Distribution and release closeout

Purpose: prove that the exact package we would hand to a person is installable before asking that person to test it.

Status: **automated qualification implemented; immutable candidate must advance whenever code changes**.

- [x] Non-technical `Install Efesto.cmd` path.
- [x] Self-healing launcher prerequisites.
- [x] Immutable internal artifact packaging with SHA-256 manifest and BUILD_INFO commit binding.
- [x] Production dependency audit without a GHSA ignore.
- [x] Windows launcher, first-run and pairing recovery automation.
- [x] `0.1.0-internal.6` preserved as the immutable previous runtime-readiness candidate.
- [x] `0.1.0-internal.7` through `0.1.0-internal.10` frozen as non-promotable automated-qualification candidates.
- [x] `0.1.0-internal.11` qualified the exact-package automation and is now frozen after subsequent source/runtime work.
- [x] Add exact-ZIP download, checksum/commit verification and extraction to a path containing spaces.
- [x] Add Windows 2022 + Windows 2025 packaged-install qualification.
- [x] Exercise a real fresh unpaired install from the ZIP with pairing truthfully required.
- [x] Require runtime builds, Kernel ownership verification, Hermes readiness and trusted shortcut from the extracted ZIP.
- [x] Add a separate paired repair with private Kernel-token digest preservation.
- [x] Add credential-leak detection against captured repair output and sanitized diagnostic artifacts.
- [x] Isolate qualification shutdown from PowerShell/pnpm stderr semantics and verify the trusted launcher exit code directly.
- [x] Add Gherkin + machine-checked release-contract regression coverage.
- [ ] Qualify `0.1.0-internal.12` through both packaged-install matrix jobs and full CI/Chromium/Windows gates for the final Memory Safety E1 SHA.
- [ ] Merge and prove the merged `main` SHA through the same affected gates.
- [ ] UAT-1 through UAT-6 on the exact resulting `internal.12` artifact.
- [ ] Public-release PR/tag only after UAT passes and `publicLaunchApproved` is explicitly promoted.

## Enterprise measurement — Issue #186

Purpose: measure Efesto as a product/business, not only as a repository.

Primary KPIs:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Repeat Goal Usage.

Drivers/guardrails include mission completion/failure rate, installation-to-first-Goal activation, Find usefulness/dismissal, notification delivery, altered-replay acceptance = 0, unauthorized memory admission = 0, credential/privacy leakage = 0, and exact packaged install/repair success.

Initial measurement must remain local-first. No central telemetry is introduced merely to obtain business metrics; aggregate sharing requires a separate opt-in privacy design.

## Phase G — Product Design formalization

Purpose: turn the stable Goal-first product into a coherent product system rather than decorating unstable contracts.

Status: **Issue #192 is blocked until #191 freezes Memory Safety contracts**.

Planned design deliverables:

- [ ] formal product/design brief tied to real Kernel capabilities and user journeys;
- [ ] information architecture and priority hierarchy for Goal, Missions, Finds, Evidence, Models, Agents, Automations and Settings;
- [ ] design tokens and component/system language for the Efesto cyber-forge identity;
- [ ] exact visual mapping for offline, ready, queued, investigating, verifying, completed and failed states;
- [ ] three distinct visual directions for selection before implementation;
- [ ] selected direction translated faithfully into responsive frontend code;
- [ ] accessibility, reduced-motion and mobile acceptance;
- [ ] design QA against the rendered implementation and source target;
- [ ] real release-candidate screenshots only after the implementation is validated.

## Phase H — Product narrative and evidence

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
- accept validation/admission/quarantine authority from agent output;
- expose trusted Kernel routes publicly without a new security design;
- add fake UI state or animation that implies work not present in persisted/streaming state;
- authorize purchases, logins or form submissions as part of the current Golden path;
- reuse an internal candidate number after shipped behavior or release-validation changes;
- start visual redesign work against contracts that are still moving.

## Next bounded sequence

1. Merge #185 only after architecture, full CI, Chromium and exact Windows packaged qualification are green.
2. Execute #187, #188, #189 and #190 one bounded PR at a time.
3. Close #191 only after adversarial contract-freeze coverage is green.
4. Complete #186 local-first product measurement instrumentation.
5. Begin #192 Product Design against the frozen Goal-first product.
6. Run UAT-1 through UAT-6 on the exact immutable candidate selected after affected engineering work.
7. Promote publicly only after the UAT evidence is complete.

## Definition of “project star”

The product reaches the intended engineering and product bar when the user-value, safety, measurement and distribution loops are demonstrable:

```text
A user installs the exact qualified package.
The local Kernel proves ownership and readiness.
The user gives Efesto a Goal.
An agent or native capability researches bounded public sources.
The Kernel preserves Evidence and provenance.
The Kernel blocks forged authority and altered history.
Useful Opportunities are ranked and surfaced.
Exact replay is safe and side effects remain controlled.
Unsafe or questionable memory can be quarantined/reviewed without agent authority.
The operator can understand why a result was trusted, rejected, retained or isolated.
The product measures whether Goals actually produce useful Finds while preserving privacy.
The product UI mirrors real states faithfully.
```
