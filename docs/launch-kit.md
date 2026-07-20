# HEPHAESTUS Launch Kit

This document is the short, reusable narrative for demos, repository reviews, founder conversations, and launch drafts. It describes the verified product; it must not imply that Issue #57 real-runtime validation or release readiness is complete.

## One-sentence description

HEPHAESTUS is a local-first AI-forensics and memory-safety Kernel that turns agent runs into evidence-backed cases before any claim can become durable memory.

## One-minute explanation

Autonomous agents can discover useful information, but their output should not become trusted memory just because a model produced it. HEPHAESTUS creates a controlled boundary between an agent and institutional memory.

Hermes or another agent submits operational evidence and a claim proposal through a signed local route. The Kernel verifies the request, preserves evidence, runs validation and contradiction checks, decides admission, and records an idempotent receipt. Replaying the same run is safe; changing the payload while reusing its identity is blocked.

Replay Lab then gives the operator a read-only explanation of the case, evidence, proposed claim, Kernel decisions, replay state, and enforced authority boundary. The agent proposes; the Kernel decides what may persist.

## Five-minute demo flow

1. Run `pnpm build`.
2. Run `pnpm hermes:smoke` and show that exact replay returns the original cognitive record ID.
3. Run `pnpm hermes:attack-smoke` and show `409 HERMES_IDEMPOTENCY_CONFLICT` for the altered replay.
4. Open Replay Lab and point to the evidence, claim proposal, Kernel gates, receipt state, and Authority Boundary panel.
5. State the current limitation honestly: the secured path still needs one sanitized output from the user's real Hermes runtime to close Issue #57.

The exact commands and expected results are maintained in `docs/hermes-demo-quickstart.md`.

## Founder-facing pitch

AI systems are gaining tools and memory faster than they are gaining trustworthy judgment. HEPHAESTUS is the evidence and memory-safety layer between autonomous agents and durable organizational knowledge. It captures agent work as forensic cases, preserves provenance, blocks forged authority and altered history, and admits claims only through Kernel-owned gates. The long-term advantage is not another agent interface; it is trusted, reusable intelligence that becomes safer and more valuable with every investigation.

## Repository summary

HEPHAESTUS currently provides a signed local Hermes ingestion boundary, evidence-backed cognitive records, validation and admission gates, replay-safe receipts, recovery, Obsidian-compatible knowledge projection, an Internal Orchestrator, and the read-only Replay Lab operator surface.

The current open proof obligation is real Hermes runtime validation. Synthetic fixtures demonstrate the mechanism but do not replace that evidence.

## X / Twitter launch draft

> Autonomous agents should not be allowed to write trusted memory just because a model produced an answer.
>
> HEPHAESTUS is a local-first AI-forensics Kernel: signed agent ingestion, preserved evidence, Kernel-owned validation, safe replay, altered-history blocking, and a read-only Replay Lab.
>
> Agents propose. The Kernel decides what persists.

## Claims we may make now

- Signed local ingestion and replay protection are implemented and tested.
- Altered payload reuse is rejected.
- Hermes authority fields are rejected before ingestion.
- Replay Lab exposes persisted forensic state through an authenticated read-only API and operator UI.
- The deterministic local demo works without paid external APIs.

## Claims we must not make yet

- That real Hermes runtime validation is complete.
- That HEPHAESTUS is production-ready or externally released.
- That rejected payload contents are persisted or attributable to an accepted Replay Lab case.
- That every long-term roadmap phase is implemented.
- That synthetic fixtures prove provider-specific compatibility.
