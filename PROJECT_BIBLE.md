# PROJECT BIBLE

This document explains how to build Internet Brain OS without losing the original vision.

Every LLM, agent, and contributor must read this before making changes.

## One-sentence product definition

Internet Brain OS is a local-first AI system that turns public internet information into evidence-backed memory, relationships, insights, opportunities, and actions.

## Primary user

The initial user is a solo builder, researcher, entrepreneur, operator, or small agency that needs to investigate public web information and turn it into decisions without paying for expensive infrastructure.

## Primary use cases

1. Analyze a company.
2. Analyze a competitor.
3. Find suppliers.
4. Find e-commerce opportunities.
5. Track product and price changes.
6. Build public lead intelligence.
7. Create reusable datasets.
8. Generate Obsidian knowledge notes.
9. Monitor markets and niches.
10. Produce evidence-backed research reports.

## The first product experience

The user should not start from an empty dashboard.

The system should ask:

> What do you want to understand, find, monitor, or decide?

The answer creates a Case.

## Core objects

### Case

A Case is an investigation workspace.

Examples:

- Find European suppliers for pet accessories.
- Analyze a Shopify competitor.
- Monitor pricing changes in a niche.
- Build a lead list of local businesses without AI chatbots.

A Case contains objectives, sources, evidence, entities, notes, reports, exports, and tasks.

### Evidence

Evidence is the raw support behind a conclusion.

Evidence may include:

- URL.
- Page title.
- Timestamp.
- Extracted text.
- Screenshot path when available.
- Selector or extraction method.
- Confidence score.
- Model used.
- Notes about limitations.

No serious conclusion should exist without evidence.

### Entity

An Entity is a meaningful thing discovered by the system.

Examples:

- Company.
- Person.
- Product.
- Domain.
- Supplier.
- Competitor.
- Technology.
- Advertisement.
- Document.
- Market.

### Hypothesis

A Hypothesis is an AI-generated idea that may or may not be true yet.

Examples:

- This store may use the same supplier as another store.
- This product category may be growing.
- This business may be a good lead because its website has clear conversion gaps.

Hypotheses must be labeled as hypotheses until verified.

### Skill

A Skill teaches the system how to work in a specific domain.

Examples:

- Shopify Intelligence.
- Amazon Product Analysis.
- Supplier Finder.
- SEO Audit.
- Competitor Tracker.
- Obsidian Export.

Skills must be modular.

### Kernel

The Kernel is the durable core of the system.

It coordinates:

- Cases.
- Memory.
- Evidence.
- Agents.
- Skills.
- Exports.
- Handoff.

The Kernel must be small, boring, stable, tested, and hard to break.

## User experience model

The product has three surfaces:

1. Browser Extension: the live web copilot and overlay.
2. Dashboard/Desktop App: case management, reports, memory, settings, exports.
3. Obsidian Vault: durable human-readable knowledge base.

The extension should not do heavy work. It observes context, captures pages, lets the user trigger missions, and sends structured input to the Kernel.

## Free-first model strategy

The product must work with:

- Ollama.
- Small local models.
- OpenCode.
- Hermes.
- Codex or stronger models only when available.

Use powerful models for:

- Architecture review.
- Complex reasoning.
- Refactoring plans.
- Deep research synthesis.
- Security review.

Use smaller models for:

- Classification.
- Summaries.
- Extraction cleanup.
- Note drafting.
- Simple transformations.

## Obsidian strategy

Obsidian is a first-class memory target.

Every Case should be exportable as Markdown notes:

```text
Cases/<case-name>/Index.md
Cases/<case-name>/Evidence/<evidence-id>.md
Entities/Companies/<company>.md
Entities/Products/<product>.md
Entities/Suppliers/<supplier>.md
Reports/<case-name>-report.md
```

Use backlinks and YAML frontmatter.

## Safety and legality

The system must focus on public and authorized information only.

Do not implement features designed to:

- Bypass authentication.
- Evade paywalls.
- Break rate limits aggressively.
- Access private information without permission.
- Spam people.
- Hide abusive automation.

Deep research means thorough public research, not illegal access.

## Long-term vision

Internet Brain OS becomes a living intelligence workspace where every search, extraction, note, report, and user correction makes the system smarter.

The endgame is not a better scraper.

The endgame is a second brain that can investigate the public internet with evidence, memory, curiosity, and discipline.
