# HEPHAESTUS

**The Intelligence Forge — evidence and memory safety for autonomous agents.**

Hephaestus is a local-first AI intelligence Kernel. It turns public-internet research and agent runs into evidence-backed cases before any claim can become trusted, connected memory.

Hermes and other agents may discover sources, record evidence, and propose claims. The Kernel owns validation, contradiction checks, admission, replay protection, and persistence. The first visible operator surface, Replay Lab, explains what happened without granting the UI or the agent authority over memory.

```text
Agent run → signed ingestion → evidence-backed case → Kernel gates → controlled memory
                  ↘ exact replay: safe
                  ↘ altered replay: blocked
```

## What this is / what this is not

Hephaestus is:

- An evidence-first intelligence and AI-forensics Kernel.
- A local boundary between agent output and durable memory.
- A reusable foundation for sourcing, research, monitoring, and decision intelligence.
- LLM-flexible, Obsidian-compatible, and free or near-zero-cost by default.

Hephaestus is not:

- A generic scraper or a prettier log viewer.
- An autonomous agent with permission to rewrite its own history.
- A cloud-only observability product.
- A route for Hermes or another model to bypass validation and write durable memory directly.

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

To run the complete first-test gate with one command:

```bash
pnpm verify:first-run
```

This verifies type safety, unit/integration tests, the production build, both supported Hermes export formats, signed ingestion, exact replay, altered-replay rejection, and the authenticated Replay Lab API. It uses temporary local data and development-only smoke credentials; it does not write secrets or test records into the repository.

For the full demo, including local server ingestion and replay checks, read:

- `docs/hermes-demo-quickstart.md`
- `docs/hermes-real-runtime-validation.md`
- `docs/hermes-ingestion-contract.md`

### Import a real Hermes run in Replay Lab

Build and start the loopback-only Kernel with a local Hermes boundary secret:

```bash
pnpm build
IBOS_HERMES_SECRET="use-a-local-development-secret" pnpm kernel:serve
```

Open `http://127.0.0.1:4000/replay-lab`, paste the private local API token from `.hephaestus/kernel-api-token`, and select a sanitized `.json` or `.jsonl` Hermes capture. **Validate capture** performs no writes. **Ingest validated run** is a separate explicit action that signs server-side, passes through the existing authority and idempotency boundary, and then refreshes the investigation list.

The browser never receives the Hermes boundary secret. Captures containing recognized secrets or Kernel-owned authority fields are rejected before ingestion and are not persisted.

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

## Current architecture

```text
Hermes / browser extension / CLI
              │
              ▼
 authenticated loopback-only API
              │
              ▼
      HEPHAESTUS KERNEL
   ┌──────────┼───────────┐
   │          │           │
Evidence   Cognitive   Replay-safe
  store     gates      receipts
   │          │           │
   └──────────┼───────────┘
              ▼
 controlled memory + Obsidian
              │
              ▼
     Replay Lab (read only)
```

See `docs/architecture.md` for system boundaries and `docs/launch-kit.md` for the one-minute explanation and demo narrative.

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

## Efesto Opportunity Radar

A private, local-first **opportunity intelligence** browser extension (Chrome MV3). It watches what you
read, scores it against your active Goals via the local Hephaestus Kernel, and writes the useful
captures into your Obsidian vault as Cases / Evidence / Opportunities. Nothing leaves your machine.

### Try it
- Landing page: `apps/web/landing/index.html` (open locally, or deploy via GitHub Pages).
- Download the packaged extension: `efesto-extension.zip` (built with `npm run build:extension`).

### Install (Load unpacked)
1. Run the local Kernel: `npm run kernel:serve` (listens on `http://127.0.0.1:4000`).
2. In Chrome, open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select `apps/extension/dist` (or unzip `efesto-extension.zip`).
4. Reload the extension after any code change.

### How it works
- **Auto Radar**: a service worker observes navigation (URL changes, SPA, tab activation) and
  extracts minimal context (canonical URL, title, visible text).
- **Goal matching**: `scoreRelevance()` scores the page against active Goals from the Kernel
  locally; only pages above the threshold are submitted. Irrelevant pages are discarded (`IRRELEVANT`).
- **Fuzzy dedupe**: `fuzzyDuplicate()` (Jaccard similarity, threshold 0.5) detects reposts / near-identical
  content so the same opportunity is not stored twice.
- **Privacy**: no passwords, cookies, or localStorage are captured. Data is sent only via authenticated
  Kernel endpoints (`POST /api/browser/page-context`).

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
