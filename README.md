# Internet Brain OS

Internet Brain OS is a local-first AI web intelligence system.

It is not a scraper. Scraping is only one internal capability.

The product turns public information from the internet into connected memory, evidence, analysis, opportunities, and actions.

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

## Non-negotiable direction

Internet Brain OS must remain:

- Local-first.
- Evidence-first.
- Modular.
- LLM-flexible.
- Obsidian-compatible.
- Free or near-zero-cost by default.
- Safe, legal, and focused on public/authorized information.

## Initial build target

Phase 0 is not the full product.

Phase 0 is the minimum kernel:

```text
User objective
  -> Case creation
  -> Local memory
  -> Basic web extraction from public pages
  -> Evidence capture
  -> Markdown notes
  -> Obsidian export
  -> Simple report
```

## Mandatory reading order

Every human or AI contributor must read these files before making changes:

1. `PROJECT_DNA.md`
2. `PROJECT_BIBLE.md`
3. `AI_CONSTITUTION.md`
4. `brain/FOUNDER_VISION.md`
5. `brain/BRAIN_LOG.md`
6. `LLM_HANDOFF.md`
7. `AGENT_ROLES.md`
8. `docs/hermes-operating-protocol.md`
9. `docs/obsidian-sync-protocol.md`
10. `docs/architecture.md`
11. `ROADMAP.md`
12. `DECISIONS.md`
13. The active task or GitHub issue.

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

No AI may silently redefine the product, weaken the Constitution, or merge critical Kernel changes without review.

## Execution rule

Work on one bounded task at a time.

Non-trivial work should happen on a branch and enter through a reviewable pull request using `.github/pull_request_template.md`.

A task is not complete until its tests, handoff, documentation, and Obsidian Knowledge Sync are complete.

## Golden rule

Every search must make the system smarter.

If a feature does not strengthen the Kernel, memory, evidence, agents, workflows, Obsidian knowledge, or user decision-making, it does not belong in the core product.
