# DECISIONS

This file records major product and technical decisions.

Do not delete old decisions. If a decision changes, add a new entry explaining why.

## 2026-07-10 - Product identity

Decision: Internet Brain OS is not a generic scraper.

It is a local-first AI web intelligence system that uses scraping, extraction, memory, evidence, Obsidian notes, agents, and Skills to turn public web information into decisions.

Reason:

A generic scraper is easy to copy and low-value. A memory/evidence/intelligence system is more defensible and useful.

## 2026-07-10 - Local-first and free-first

Decision: The product must work locally and with free/low-cost models first.

Reason:

The founder has limited budget. The architecture must not depend on expensive paid APIs to function.

Implications:

- Ollama support is important.
- Local storage is required.
- Cloud sync is optional, not mandatory.
- Paid LLMs are used only for high-value tasks.

## 2026-07-10 - Obsidian as memory layer

Decision: Obsidian is a first-class integration, not a simple export.

Reason:

Human-readable Markdown notes make the system durable, portable, and user-owned.

Implications:

- Cases should export to Markdown.
- Entities should become notes.
- Evidence should become notes.
- Backlinks should connect knowledge.
- YAML frontmatter should support structured querying.

## 2026-07-10 - Evidence-first design

Decision: Every serious claim must link back to evidence.

Reason:

The product must be trustworthy. AI conclusions without evidence are not enough.

Implications:

- Evidence model is core.
- Reports must cite evidence IDs.
- Confidence and uncertainty must be explicit.

## 2026-07-10 - Kernel-first architecture

Decision: Build a small stable Kernel before advanced UI or marketplace features.

Reason:

The Kernel makes future Skills, extensions, dashboards, and agents possible.

Implications:

- Phase 0 focuses on Case, Evidence, Memory, Obsidian export, and reports.
- Browser extension comes after local core works.
