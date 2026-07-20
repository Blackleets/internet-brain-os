# HEPHAESTUS

**The Intelligence Forge.**

Hephaestus is a local-first AI intelligence system for the public internet.

It is not a scraper. Scraping is only one internal capability.

The product turns public information from the internet into connected memory, evidence, analysis, opportunities, and actions.

## Try the Hermes → Kernel demo

The fastest safe demo proves the AI Forensics boundary between Hermes-style agent output and the local Kernel:

```text
Hermes output
→ offline validation
→ signed local ingestion
→ idempotent Kernel processing
→ replay-safe cognitive record
→ altered replay blocked
```

```bash
pnpm install
pnpm build
pnpm hermes:smoke
pnpm hermes:attack-smoke
pnpm hermes:validate-agent examples/hermes-agent-run-output.sample.json
pnpm hermes:validate-agent --native-jsonl examples/hermes-native-log.sample.jsonl
```

For the full demo, including local server ingestion and replay checks, read:

- `docs/hermes-demo-quickstart.md`
- `docs/hermes-real-runtime-validation.md`
- `docs/hermes-ingestion-contract.md`

For the product story behind the demo, read:

- `docs/ai-forensics-case-study.md`
- `docs/product-star-roadmap.md`
- `docs/replay-lab-contract.md`
- `docs/replay-lab-api.md`

## Core idea

Give the system an objective, not a selector.

Example:

> Find European suppliers for a niche e-commerce idea and build an evidence-backed opportunity report.

The system should:

1. Discover public sources.
2. Extract useful information.
3. Save evidence.
4. Connect entities in memory.
5. Generate hypotheses.
6. Produce an actionable report.
7. Export results.
8. Sync knowledge to Obsidian.

## The Forge Model

```text
OBJECTIVE
   ↓
CASE
   ↓
SOURCES → EVIDENCE
             ↓
       ENTITIES + RELATIONSHIPS
             ↓
        KNOWLEDGE GRAPH
             ↓
      INSTITUTIONAL MEMORY
             ↓
        AGENTS + ANALYSIS
             ↓
           REPORT
```

## Non-negotiable direction

Hephaestus must remain:

- Local-first.
- Evidence-first.
- Modular.
- LLM-flexible.
- Obsidian-compatible.
- Free or near-zero-cost by default.
- Safe, legal, and focused on public/authorized information.

## Product identity

**Name:** Hephaestus  
**Codename:** The Intelligence Forge  
**Mission:** Transform the open internet into evidence-backed, connected intelligence.

The project is named after Hephaestus, the Greek god of fire, craftsmanship, metallurgy, and extraordinary creations. The metaphor is deliberate: raw information enters the forge; structured knowledge and actionable intelligence come out.

## Mandatory reading order

Every human or AI contributor must run `pnpm resume` and read these files before making changes:

1. `PROJECT_STATE.md`
2. `AGENTS.md`
3. `PROJECT_DNA.md`
4. `PROJECT_BIBLE.md`
5. `AI_CONSTITUTION.md`
6. `brain/FOUNDER_VISION.md`
7. `brain/BRAIN_LOG.md`
8. `LLM_HANDOFF.md`
9. `AGENT_ROLES.md`
10. `docs/hermes-operating-protocol.md`
11. `docs/hermes-ingestion-contract.md`
12. `docs/hermes-demo-quickstart.md`
13. `docs/hermes-real-runtime-validation.md`
14. `docs/ai-forensics-case-study.md`
15. `docs/product-star-roadmap.md`
16. `docs/replay-lab-contract.md`
17. `docs/replay-lab-api.md`
18. `docs/obsidian-sync-protocol.md`
19. `docs/architecture.md`
20. `ROADMAP.md`
21. `DECISIONS.md`
22. The active task or GitHub issue.

## Institutional memory

This repository is not only a code repository.

It is the institutional memory and operating doctrine of the company.

Important strategic conversations, product discoveries, architecture decisions, failed experiments, risks, and lessons must be captured in versioned documentation and synchronized to Obsidian.

Nothing important may exist only in a temporary AI conversation.

## Operating model

- Founder: final strategic authority.
- Strategic CEO/reviewer: protects product coherence and reviews major decisions.
- Hermes: operational orchestrator and model router.
- OpenCode/Codex/other models: specialized implementation and review workers.
- GitHub: source of truth for code and versioned operating doctrine.
- Obsidian: human-readable institutional brain.

## Golden rule

Every search must make the system smarter.

If a feature does not strengthen the Kernel, memory, evidence, agents, workflows, Obsidian knowledge, or user decision-making, it does not belong in the core product.
