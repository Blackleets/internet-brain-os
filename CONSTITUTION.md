# EFESTO CONSTITUTION

## The Intelligence Forge — Estrella Polar del proyecto

**Canonical product:** HEPHAESTUS / Efesto
**Canonical repository:** `Blackleets/internet-brain-os`
**Status:** active project constitution
**Last amended:** 2026-08-12

This document is the durable product, authority, safety, and engineering contract for Efesto. It applies to the Founder, Hermes, Codex, OpenCode, local models, implementation workers, reviewers, scripts, integrations, and every future agent that works in this repository.

`CONSTITUTION.md` is the canonical constitutional entry point. `PROJECT_STATE.md` describes live status, `ARCHITECTURE.md` describes implementation direction, and `LLM_HANDOFF.md` preserves session continuity. Those documents must implement and respect this constitution; they do not silently replace it.

The former `AI_CONSTITUTION.md` is retained as a compatibility and historical pointer. It is not a second authority.

## Article I — Identity and mission

Efesto is a local-first platform for evidence, memory, and trust for AI agents. It transforms public or explicitly authorized information and bounded agent runs into provenance-backed knowledge that people can inspect, remember, connect, and use for decisions.

Efesto is the forge:

```text
Goal or question
  → authorized agent work
  → validated ingestion
  → Case and Evidence
  → Kernel-owned gates
  → Claims, Findings, relationships, or hypotheses
  → controlled memory
  → human decisions and useful actions
```

The product promise is not “more scraped data.” The product promise is less cognitive load and better decisions because every durable conclusion can be traced to what was observed, how it was validated, and which Kernel rules admitted it.

The permanent north star is:

> We do not want AI to think instead of people. We want people to never think alone in front of an ocean of information.

## Article II — What Efesto is and is not

Efesto is:

- an evidence-first intelligence and AI-forensics Kernel;
- a local boundary between agent output and durable memory;
- a reusable foundation for research, monitoring, sourcing, opportunity discovery, and decision intelligence;
- LLM- and provider-neutral at the domain core;
- compatible with free, low-cost, local, and user-controlled models;
- a system that can project knowledge to human-readable surfaces such as Obsidian when that integration is configured and real.

Efesto is not:

- a generic scraper or a prettier log viewer;
- a spam, surveillance, data-theft, black-hat OSINT, or credential-bypassing tool;
- an agent that can rewrite its own authority history;
- a cloud-only product or a mandatory paid-LLM service;
- a system that treats model prose, search snippets, hidden reasoning, or UI decoration as proof;
- a replacement for human approval where an action is consequential, irreversible, private, or outside the authorized capability boundary.

Scraping may be a capability. Intelligence, provenance, memory safety, and trustworthy decisions are the product.

## Article III — Kernel sovereignty

The Hephaestus Kernel is the final authority over durable product truth. The Kernel owns, validates, and persists:

- Cases, Evidence, provenance, claims, relationships, and controlled Memory;
- validation, normalization, contradiction handling, admission, lifecycle, replay, and recovery;
- capability, risk, authorization, consent, and approval gates;
- idempotency, retry boundaries, persistence, and auditable failure state.

Hermes and every other agent are external execution principals. They may discover, research, transform bounded input, and propose. They may not:

- declare their own output trusted;
- manufacture Kernel validation, contradiction, admission, capability, or durable-memory fields;
- bypass authentication, authorization, consent, replay, provenance, or persistence gates;
- become the aggregate root of the Kernel or rewrite their own history;
- turn an unverified candidate, snippet, or model assertion directly into Evidence or Memory.

Hermes is the external discovery, tool, provider, transport, and execution layer. The Hermes Agent repository is separate from this repository. A Hermes integration belongs behind a typed, bounded adapter; provider-specific behavior must not leak into the Hephaestus domain core.

The dashboard, browser extension, Replay Lab, and future operator surfaces are clients or read models. They may request authenticated Kernel operations, but they are not sources of authority. Replay Lab explains persisted records and proposed prevention; it cannot alter memory authority.

## Article IV — Evidence before memory

Efesto must preserve the distinction between observation, interpretation, hypothesis, decision, and memory.

1. **Candidate or lead:** an untrusted locator or proposal that still requires Kernel verification.
2. **Evidence:** retained source material with provenance, timing, integrity, and known limitations.
3. **Claim or Finding:** a bounded interpretation linked to the Evidence that supports it.
4. **Hypothesis:** an explicitly uncertain proposition that remains unverified until its conditions are met.
5. **Memory:** durable knowledge admitted only through explicit Kernel-owned lifecycle and authority gates.

Search snippets and agent text are not Evidence. Private chain-of-thought is not Evidence, a Claim, forensic causality, or durable Memory merely because a model emits it. Forensic causality must come from persisted observable relationships and Kernel decisions, not inferred hidden intent.

Raw Evidence, provenance links, source identifiers, relevant timestamps, hashes, and history must not be silently discarded. Memory lifecycle transitions remain explicit. Consolidation may reduce duplication only when it preserves source Memory identifiers and Evidence provenance.

Exact replay must be safe and idempotent. Altered replay, malformed authority, corrupt records, stale writes, and unsupported authority fields must fail closed without partial writes or silent history repair.

## Article V — Safety, privacy, and human control

Efesto defaults to the smallest safe authority:

- public or explicitly authorized information only;
- local-first and loopback-first operation where practical;
- user-owned data, private local storage, and no central telemetry by default;
- free or low-cost models first, with paid or remote providers optional rather than mandatory;
- deny-by-default capabilities, server-side authorization, least privilege, bounded input, bounded output, bounded retries, and observable failures;
- secrets, credentials, tokens, private data, and precise personal information never committed, logged, or copied into ordinary project notes without a justified protected design;
- sensitive paths, private addresses, credential-bearing URLs, SSRF routes, unsafe redirects, and untrusted Markdown are rejected or rendered inert at the boundary.

Efesto may investigate the public web deeply, but it must never implement or encourage:

- authentication or access-control bypass;
- paywall evasion or private-data access without permission;
- aggressive rate-limit evasion, stealth collection, spam, harassment, or abusive automation;
- secret extraction, credential theft, or hidden surveillance.

Read-only public research is not permission for side effects. Purchases, payments, logins, messages, form submissions, file mutation, durable-memory admission, and other irreversible or consequential actions require a separate capability and explicit approval appropriate to the risk. No agent may self-approve them.

## Article VI — Truthful autonomy

Autonomy is valuable only when it is bounded, observable, reversible, and honest.

- A Goal expresses what the user wants to understand, find, monitor, or decide. A Goal alone does not authorize network access or side effects.
- A trusted, revision-bound authorization and the relevant capability policy are required before automatic work.
- Agents receive only the bounded scope they need and return only a validated contract.
- Retries, leases, attempts, timeouts, subprocesses, and output sizes are explicitly bounded and recoverable.
- Idempotent replay and restart recovery are required where work can be repeated.
- A synthetic fixture, a workflow existing, or a UI state being rendered is not proof of an authentic external runtime or a successful real-world journey.
- A failure, unavailable integration, missing model, or unproven external dependency must remain visible as such; the system must not fabricate progress, Evidence, Findings, readiness, or completion.

## Article VII — Product experience

The user experience begins with the user’s Goal or next decision, not with internal subsystem names. Efesto should help a person move from intention to a useful, provenance-backed result without drowning in raw output.

The extension is a lightweight capture and operator surface. The Kernel does the authoritative work. The dashboard and Replay Lab explain state without becoming a second source of truth. Obsidian projections are useful only when they are real, private, inert, and synchronized from Kernel-owned records.

Every visible control must have a real action, a truthful disabled state, or an explicit unavailable explanation. Progress, opportunities, graph edges, mission state, model availability, and readiness must come from observable persisted facts. The pixel forge and other animation may communicate state; it may never invent research or authority.

Desktop, mobile-width, keyboard, focus, touch-target, reduced-motion, contrast, loading, empty, error, and success states are part of product quality. Presentation must not weaken authorization or make an unverified lead look like a verified opportunity.

## Article VIII — Engineering discipline

Every change must preserve the constitution and the smallest coherent surface that already works.

1. Resolve the canonical repository, branch, task, and authorization before editing.
2. Preserve unrelated user changes and inspect current Git status and file SHA before sequential updates.
3. Prefer small, typed, additive, reviewable changes over broad rewrites.
4. Do not add infrastructure, dependencies, providers, or cloud services without a measured product, reliability, security, scale, or operability need.
5. Preserve public contracts and backward compatibility unless a deliberate migration is documented.
6. Add or update the narrowest useful regression test for changed behavior, especially negative security and authority tests.
7. Validate architecture boundaries, types, tests, builds, and relevant end-to-end behavior before claiming completion.
8. Keep domain modules provider-neutral, adapters bounded, errors contextual, and failure paths explicit.
9. Update durable project records when vision, architecture, security posture, contracts, release state, or the next priority changes.
10. Never hide uncertainty, overstate validation, or label an unverified assumption as a fact.

Core Kernel changes require a written change request covering the proposed behavior, reason, breakage risk, files, tests, rollback, and how the change strengthens evidence, memory, agents, workflows, or decisions. Critical changes require review and explicit approval through the repository’s normal workflow.

## Article IX — Agent preflight gate

No human or AI agent may edit code, documentation, tests, scripts, configuration, workflows, or generated contracts until this preflight is complete. The first mandatory reading is the complete `CONSTITUTION.md`.

Before each task, the agent must:

1. Confirm that the target is `Blackleets/internet-brain-os` and that no other project, especially `Blackleets/hermes-agent`, is being mixed into it.
2. Read this document completely.
3. Run `pnpm resume` and read `PROJECT_STATE.md` as the live continuity checkpoint.
4. Read `AGENTS.md`, `ARCHITECTURE.md`, `docs/architecture-guardrails.md`, and the relevant package, contract, tests, and active GitHub item.
5. Inspect branch, current SHA, dirty/untracked files, and the smallest relevant implementation surface.
6. State the bounded task, files expected to change, invariants to preserve, acceptance criteria, risks, and rollback path.
7. Stop for human review if the task conflicts with this constitution, expands authority, or requires a product or ethical boundary change.

Hermes must perform this gate at startup and must pass the same gate to every worker it coordinates. A worker that has not read the constitution has no authority to edit this repository.

## Article X — Completion and institutional memory

A task is complete only when the implementation or document is coherent, the relevant tests and checks are fresh, the final diff is scoped, and a future agent can continue without access to the original conversation.

For meaningful work, the responsible agent updates the relevant durable records, normally including `LLM_HANDOFF.md`, `CHANGELOG.md`, `DECISIONS.md`, `PROJECT_STATE.md`, architecture or roadmap files when affected, and the applicable Obsidian/session record when that integration is configured. No project memory may remain only in a temporary chat.

Completion reports must distinguish:

- implemented behavior from planned behavior;
- deterministic or synthetic proof from authentic external proof;
- local readiness from public-launch readiness;
- verified facts from hypotheses, residual risks, and blockers.

## Article XI — Constitutional amendments

This document may evolve, but it must not be weakened silently. An amendment must:

- state the reason and affected principle;
- preserve a readable history through Git and the relevant decision/handoff records;
- identify security, privacy, authority, and rollback consequences;
- receive explicit Founder or maintainer approval when it changes a permanent product, ethical, or authority boundary;
- update the agent entry points and regression checks that enforce the preflight.

When another document or an agent proposal conflicts with this constitution, stop and request review. Speed, convenience, model preference, and a green superficial UI do not override the North Star.

## Compact constitutional axioms

```text
Evidence before memory.
Kernel authority before agent autonomy.
Public/authorized data before private access.
Local ownership before cloud dependency.
Truthful state before impressive presentation.
Bounded, reversible work before uncontrolled automation.
Provenance and history before convenience.
Human approval before consequential side effects.
```
