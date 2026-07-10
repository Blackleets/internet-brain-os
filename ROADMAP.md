# ROADMAP

Internet Brain OS must grow in controlled phases.

Do not jump to advanced features before the Kernel works.

## Phase 0 - Minimum Kernel

Goal: prove the core loop works locally.

Core loop:

```text
Objective -> Case -> Evidence -> Memory -> Obsidian notes -> Report
```

Deliverables:

- Project structure.
- Case model.
- Evidence model.
- Local storage.
- Basic web/page ingestion.
- Markdown/Obsidian exporter.
- Simple report generator.
- CLI or minimal local command runner.
- Basic tests.

Success criteria:

- User can create a Case from a text objective.
- System can save public evidence.
- System can generate Obsidian-compatible Markdown.
- System can produce a basic evidence-backed report.
- No paid cloud service is required.

## Phase 1 - Browser Extension Copilot

Goal: make the system useful while browsing.

Deliverables:

- Chrome/Chromium extension.
- Floating AI button.
- Page context capture.
- Send current page to Kernel.
- Trigger Case from current page.
- Basic side panel.
- Local backend connection.

Success criteria:

- User can browse a public page and send it to a Case.
- Extension does not do heavy work.
- Kernel receives structured context.

## Phase 2 - Skills System

Goal: make intelligence modular.

Deliverables:

- Skill manifest format.
- Skill runner.
- Shopify Intelligence Skill.
- Supplier Finder Skill.
- Competitor Snapshot Skill.
- Obsidian Export Skill.

Success criteria:

- New Skills can be added without rewriting the Kernel.
- Skills produce evidence and entities in standard formats.

## Phase 3 - Knowledge Graph

Goal: connect entities into reusable memory.

Deliverables:

- Entity graph model.
- Relationship model.
- Graph queries.
- Obsidian backlinks.
- Case-to-entity linking.

Success criteria:

- System can answer: what do we know about this company/product/supplier?
- Repeated investigations reuse previous knowledge.

## Phase 4 - Monitoring and Alerts

Goal: detect change over time.

Deliverables:

- Scheduled checks.
- Page snapshots.
- Change diffing.
- Price/product monitoring.
- Notification hooks.

Success criteria:

- User can monitor a source and receive meaningful change summaries.
- Alerts are ranked to avoid notification spam.

## Phase 5 - AI Overlay and Live Browser Intelligence

Goal: make the web feel intelligent.

Deliverables:

- Context-aware page overlays.
- Opportunity scores.
- Confidence scores.
- Quick actions.
- Evidence preview.

Success criteria:

- The extension adapts to the page context.
- User sees useful intelligence without leaving the page.

## Phase 6 - Marketplace and Skill Economy

Goal: allow Skills, agents, templates, and workflows to be shared.

Deliverables:

- Skill packaging.
- Local installation.
- Marketplace metadata.
- Trust/review model.
- Versioning.

Success criteria:

- Users can install new capabilities without changing the Kernel.

## Long-term future

- AI Missions.
- Curiosity Engine.
- Internet Relationship Map.
- Research Timeline.
- AI Daily Brief.
- Deep public research mode.
- Local/cloud hybrid agents.
- Team workflows.
- API and MCP support.
