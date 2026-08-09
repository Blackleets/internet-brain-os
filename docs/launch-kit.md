# HEPHAESTUS Launch Kit

This document is the short, reusable narrative for demos, repository reviews, founder conversations, and launch drafts. It describes the verified product. Authentic Hermes ingestion and Agent Hub runtime proof are complete; public release approval remains separately gated by the immutable Windows UAT checklist.

## One-sentence description

HEPHAESTUS is a local-first AI-forensics and memory-safety Kernel that turns agent runs and public-web research into evidence-backed cases before any claim can become durable memory.

## One-minute explanation

Autonomous agents can discover useful information, but their output should not become trusted memory just because a model produced it. HEPHAESTUS creates a controlled boundary between an agent and durable knowledge.

Hermes or another agent submits bounded operational findings through a signed local boundary. The Kernel verifies the request, preserves Evidence, runs validation and contradiction checks, decides admission, and records replay-safe authority receipts. Replaying the same run is safe; changing the payload while reusing its identity is blocked.

Replay Lab gives the operator a read-only explanation of the case, Evidence, proposed claim, Kernel decisions, replay state, and enforced authority boundary. The agent proposes; the Kernel decides what may persist.

## Five-minute demo flow

1. Run `pnpm build`.
2. Run `pnpm hermes:smoke` and show that exact replay returns the original cognitive record ID.
3. Run `pnpm hermes:attack-smoke` and show `409 HERMES_IDEMPOTENCY_CONFLICT` for the altered replay.
4. Open Replay Lab and point to the Evidence, claim proposal, Kernel gates, receipt state, and Authority Boundary panel.
5. Show the Goal-first surface and explain that authentic Hermes runtime proof is already complete; the remaining launch gate is UAT-1 through UAT-6 on one immutable Windows candidate.

The exact deterministic commands and expected results are maintained in `docs/hermes-demo-quickstart.md`. Public-release promotion is controlled by `docs/internal-uat-v0.1.0.md` and `INTERNAL_RELEASE.json`.

## Founder-facing pitch

AI systems are gaining tools and memory faster than they are gaining trustworthy judgment. HEPHAESTUS is the evidence and memory-safety layer between autonomous agents and durable organizational knowledge. It captures agent work as forensic cases, preserves provenance, blocks forged authority and altered history, and admits claims only through Kernel-owned gates. The long-term advantage is not another agent interface; it is trusted, reusable intelligence that becomes safer and more valuable with every investigation.

## Repository summary

HEPHAESTUS currently provides signed local Hermes ingestion, an authentic Agent Hub runtime boundary, evidence-backed Cases, validation/admission gates, replay-safe receipts, recovery, public-web Goal execution primitives, Opportunity intelligence, Obsidian-compatible projection, a Goal-first Control Center, browser extension workspaces, and the read-only Replay Lab operator surface.

The current open release proof obligation is the manual/internal Windows UAT on the exact immutable candidate. CI and authentic-runtime acceptance are necessary evidence, but neither is public-launch approval by itself.

## X / Twitter launch draft

> Autonomous agents should not be allowed to write trusted memory just because a model produced an answer.
>
> HEPHAESTUS is a local-first AI-forensics Kernel: signed agent ingestion, preserved evidence, Kernel-owned validation, safe replay, altered-history blocking, Goal-driven public-web research, and a read-only Replay Lab.
>
> Agents propose. The Kernel decides what persists.

## Claims we may make now

- Signed local ingestion and replay protection are implemented and tested.
- Altered payload reuse is rejected.
- Hermes authority fields are rejected before ingestion.
- Authentic Hermes runtime acceptance through the bounded Agent Hub boundary is complete.
- Replay Lab exposes persisted forensic state through an authenticated read-only API and operator UI.
- Goal-first public-web research preserves Kernel-owned Evidence and provenance.
- The deterministic local demo works without paid external APIs.
- A Windows internal candidate is generated under explicit release controls.

## Claims we must not make yet

- That the current internal candidate is publicly approved before UAT-1 through UAT-6 pass on that same artifact.
- That every long-term roadmap phase is implemented.
- That automatic purchases, logins, form submissions or other external side effects are generally authorized.
- That synthetic fixtures alone prove provider-specific compatibility; authentic-runtime acceptance is tracked separately.
