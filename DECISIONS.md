# DECISIONS

This file records major product and technical decisions.

Do not delete old decisions. If a decision changes, add a new entry explaining why.

## 2026-08-14 - Complementos externos read-first

Decision: the Efesto Complementos directory exposes five curated external connectors behind the MCP boundary: GitHub, Gmail, Google Drive, Notion, and Google Calendar. Each connector starts with a narrow read-only scope, a local logo, an explicit capability list, and an independent Kernel-owned readiness state.

The dashboard may display and configure these connectors, but `mcp-gateway` readiness never implies that a provider account is authorized. A connector becomes `ready` only when the Kernel receives that connector's exact gateway status and capabilities. Until then the UI must show `not_configured`, keep the connector out of active capability claims, and route configuration to the real Settings surface.

Reason:

This gives Efesto a premium, understandable first connector surface without an unbounded marketplace or false connected states. The read-first boundary keeps provider-specific credentials and future write actions outside the product domain until each adapter has a reviewed authorization and receipt contract.

## 2026-08-14 - Universal integration boundary, curated first surface

Decision: Efesto remains open to any compatible tool through typed adapters and MCP, but the product surface starts with a curated set of five integration entry points. MCP is a discovery/transport boundary; it never receives authority over the Kernel, Evidence, or Memory.

The first visible set is:

- MCP gateway for compatible local or remote servers;
- native public-web research (`web.search` / `web.read`);
- Obsidian as the local, user-owned knowledge projection;
- GitHub in read-first mode for repositories, issues, and pull requests;
- one read-first document surface, initially Google Drive or Notion after audience validation.

Every discovered tool must become a Kernel capability with explicit provider, data scope, credential scope, health, risk level, consent policy, bounded execution, and receipt/provenance. R0 observation is the default; external writes and irreversible actions remain separate approval-gated capabilities. The UI should show five recommended connectors plus a quiet “add via MCP” path, not an unbounded logo grid or a connected state that the local bootstrap cannot prove.

Reason:

Efesto gains universal extensibility without turning the first-run experience into an integration marketplace. A small read-first portfolio makes the value legible, keeps the local-first promise credible, and gives the Kernel enough evidence to expand safely later.

## 2026-08-12 - Canonical Efesto constitution

Decision: `CONSTITUTION.md` is the single canonical project constitution and agent preflight contract for Efesto.

It governs product identity, Kernel sovereignty, evidence-before-memory, safety and privacy, truthful autonomy, engineering discipline, institutional memory, and constitutional amendments. `AI_CONSTITUTION.md` remains only as a compatibility pointer. Hermes and every coordinated worker must read the canonical constitution before planning or changing repository artifacts.

Reason:

Efesto needs one durable North Star that prevents product drift, authority bypass, and contradictory instructions as multiple agents and contributors work across the repository.

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

## 2026-08-13 - PWA-first mobile surface

Decision: The first mobile surface is the responsive, manifest-based Efesto
dashboard. A native Android/iOS runtime and phone-to-PC Kernel transport remain
separate slices and are not implied by mobile-width rendering or installation
metadata.

Reason:

The repository currently contains the authenticated dashboard and browser
extension, but no native mobile application. The Kernel's default authority
boundary is loopback/local-first, so adding a remote bridge merely to make a
phone appear connected would weaken privacy and token safety.

Implications:

- Reuse the existing Goal, Mission, Finds, Evidence, Chat and Settings
  contracts in the mobile-width dashboard.
- Keep touch targets, keyboard/focus behavior, reduced motion and safe-area
  spacing as acceptance requirements.
- Do not expose the Kernel token in URLs or add a public proxy.
- A native companion requires a separate reviewed transport, pairing and
  authorization contract before implementation.
