# Hephaestus Control Center — Design Specification

Date: 2026-07-26  
Status: awaiting founder review  
Branch: `codex/dashboard-control-center`

## 1. Product decision

Build `apps/dashboard` as the professional local-first command center for the existing Hephaestus system. The visual reference `C:\Users\Usuario\Downloads\Tablero de control cibernético inteligente.png` defines the target information density, hierarchy, modularity, and command-center character. It is not a literal color or asset specification.

The dashboard must be a real product surface over the current Kernel. It must not be a disconnected mock, a second source of truth, or a rewrite of the extension and Replay Lab.

## 2. Product outcome

The first release must let the operator:

1. Connect safely to the loopback Kernel.
2. Understand whether Kernel, Hermes, Efesto, Ollama, Obsidian, and Replay Lab are ready.
3. Inspect real Cases, Evidence, Opportunities, Goals, missions, and model readiness.
4. Open a Case and follow its evidence, claims, decisions, and forensic causality.
5. Start only actions already authorized by Kernel contracts.
6. Move between the dashboard, Efesto extension, and Replay Lab without losing conceptual continuity.
7. See honest empty, unavailable, loading, degraded, and failed states when data is absent.

The result should feel like a coherent intelligence operating system rather than a collection of developer tools.

## 3. Non-goals for this release

- User registration, cloud accounts, teams, billing, and subscriptions.
- Central telemetry or uploading private local data.
- Replacing the Chrome extension.
- Replacing Replay Lab's forensic authority boundary.
- Reimplementing Kernel domain rules in the frontend.
- Allowing the browser to write directly to storage, Obsidian, or durable memory.
- Pretending that scheduled automations, resource history, token usage, or graph data exist when no corresponding contract is available.
- Letting Hermes or any UI bypass Evidence, validation, contradiction, admission, or provenance gates.

## 4. Recommended technical approach

Create a Next.js application inside `apps/dashboard`, using TypeScript and React. It will run locally and call the existing loopback Kernel over HTTP.

```text
Hephaestus Control Center (Next.js, localhost)
                  |
                  | x-hephaestus-token
                  v
Authenticated loopback Kernel API (127.0.0.1:4000)
        |             |             |
        v             v             v
  Kernel stores   Hermes adapter   Obsidian projector
        |
        +---- shared truth ---- Efesto extension
        |
        +---- forensic read model ---- Replay Lab
```

The browser communicates directly with the Kernel because the current server explicitly allows loopback web origins and requires `x-hephaestus-token` for `/api/*`. No cloud proxy or duplicate backend is needed.

### Token handling

- The token is entered locally by the operator.
- It remains in tab memory by default, matching Replay Lab's security posture.
- It is never logged, committed, included in URLs, sent to analytics, or embedded at build time.
- An optional session-only persistence choice may use `sessionStorage`, never `localStorage`, and must be off by default.
- A `401 AUTH_REQUIRED` response returns the app to the connection screen without erasing the last non-sensitive UI state.

## 5. Architectural boundaries

### Dashboard shell

Owns navigation, layout, accessibility, responsive behavior, user intent, query state, and view composition.

### Typed Kernel client

Owns request construction, token injection, runtime response validation, timeouts, cancellation, normalized errors, and retry policy for safe reads.

It does not contain domain decisions.

### Dashboard projections

Existing endpoints are consumed as-is where sufficient. Missing read models are added as small, authenticated, additive Kernel projections. Projections may calculate counts and summaries from persisted records but may not invent events, confidence, progress, or relationships.

### Kernel

Remains the sole authority for Cases, Evidence, Claims, Entities, Relationships, Knowledge Graph, Opportunities, Goals, mission state, validation, memory, and persistence.

### Efesto extension

Remains the primary browser capture and per-origin consent surface. The dashboard and extension are connected through shared Kernel state, not direct DOM or extension-storage access.

### Replay Lab

Remains the advanced forensic surface. The dashboard may reuse its authenticated read models or deep-link to it, but cannot weaken import confirmation or memory-authority controls.

## 6. Information architecture

### 6.1 Overview

The default command-center view:

- Global readiness strip.
- Real counts for Cases, Evidence, Entities, Relationships, Opportunities, Goals, and missions.
- Recent Kernel activity derived from persisted records.
- Active mission panel using named phases, never fabricated percentages.
- Opportunity priority panel using existing Kernel ordering.
- Knowledge Graph preview when graph projection data is available.
- Model Forge and Obsidian readiness.
- Quick actions restricted to supported commands.

### 6.2 Investigations

- Case list with search, status, creation time, evidence count, and provenance summary.
- Case detail with Evidence, claim proposals, admission verdicts, contradictions, receipts, and report output.
- Safe handoff to Replay Lab for full causality, autopsy, prevention proposals, and real-capture import.

### 6.3 Knowledge

- Evidence library.
- Claims and admission state.
- Entities.
- Relationships.
- Knowledge Graph explorer.
- Provenance visible at every level.

If the Kernel lacks a safe public read projection, the route displays an honest unavailable state until that projection is implemented and tested.

### 6.4 Agent Hub

- Goals.
- Mission ledger.
- Hermes readiness.
- Mission phases: waiting, queued, investigating, verifying, forged, failed, expired.
- Attempt counts, timestamps, bounded failure details, findings received, Evidence created, Opportunities promoted, and Obsidian receipt.
- Explicit mission creation or retry only through existing Kernel commands.

### 6.5 Opportunities

- Existing Kernel-ranked Opportunity Inbox.
- Objective Evidence relevance separated from personal ordering.
- Goal match, source, deadline text, cautions, next action, and unverified-lead label.
- Existing feedback actions: useful, saved, dismissed, not interested.
- No hidden confidence score or automatic external action.

### 6.6 Automations

This route exposes only automation that already exists:

- Efesto Auto Radar status and explanation.
- Mission Watchtower behavior.
- Agent mission execution and bounded retries.
- Existing recurring/background behaviors that can be proven from current state.

A future scheduler may add recurring investigations, alerts, and reports. Until then, schedule toggles and fake upcoming runs are forbidden.

### 6.7 Model Forge

- Kernel-provided Ollama availability.
- Coarse device tier.
- Compatible model recommendations.
- Installed and active model distinction.
- Manual setup guidance.
- No silent download, installation, shell execution, or model-authority escalation.

### 6.8 System

- Kernel, Hermes, Obsidian, pairing, Ollama, and Replay Lab status.
- Sanitized diagnostics from `efesto.bootstrap-status.v1`.
- Safe recovery actions already exposed by the bootstrap contract.
- Connection/token management.
- Links to extension setup and Replay Lab.

## 7. API wiring matrix

| Product area | Existing Kernel contract | Initial dashboard behavior |
| --- | --- | --- |
| Readiness | `GET /health`, `GET /status`, `GET /bootstrap/status` | Fully wired |
| Cases | `GET /api/cases` | Fully wired |
| Case capture detail | `GET /api/browser/case/:id` | Fully wired |
| Replay cases | `GET /api/replay-lab/cases` and detail route | Fully wired |
| Replay import | Existing validate and explicit ingest routes | Reuse with confirmation or deep-link |
| Goals | `GET/POST /api/goals` | Fully wired |
| Missions | Existing list, create, claim, results, and failure routes | Operator-safe subset wired |
| Opportunities | `GET /api/opportunities`, feedback route | Fully wired |
| Preferences | Existing get/delete routes | Fully wired |
| Model Forge | `GET /api/model-forge` | Fully wired |
| Evidence/Claims | Domain exists; dashboard-grade list projection may be missing | Add read-only projection if required |
| Entities/Relationships | Domain exists; dashboard-grade routes are missing | Add authenticated read-only projections |
| Knowledge Graph | Domain exists; dashboard projection is missing | Add bounded graph projection |
| Historical analytics | No trustworthy time-series contract | Show current real counts only |
| Scheduler | Not implemented | No fake controls |

All new endpoints must be additive, token-protected, loopback-only, bounded, deterministic, and covered by tests.

## 8. Visual system

Working direction: **Forge Intelligence OS**.

### Composition

- Desktop-first command-center composition inspired by the source image.
- Fixed/collapsible left navigation.
- Compact top command bar.
- Twelve-column content grid.
- Dense but readable cards with clear grouping.
- Persistent system-readiness visibility.
- Responsive collapse to one column without hiding primary controls.

### Palette

- Graphite and deep navy foundations.
- Cyan for information, connectivity, and neutral system activity.
- Ember/amber for execution and Forge actions.
- Violet for AI reasoning and cognitive projections.
- Green for verified healthy state.
- Red reserved for failures, blocks, and safety violations.

The palette must meet accessible contrast requirements and may evolve during implementation. It must not imitate the source image's exact neon treatment.

### Typography

- Modern UI sans-serif with high legibility at small sizes.
- Clear numerical hierarchy using tabular numerals.
- Compact labels without forcing uppercase everywhere.
- No decorative font that reduces operational readability.

### Imagery

- Use an original Hephaestus/Forge cognitive-core hero visual.
- Do not copy the supplied brain artwork.
- Do not replace a required hero or brand asset with CSS shapes, emoji, or a low-quality placeholder.
- Generate or commission the final asset as part of the visual build and verify its fidelity and rendering quality.

### Motion

- Motion reflects real observable states only.
- Idle, waiting, investigating, verifying, forged, and failed states have distinct but restrained treatment.
- Respect `prefers-reduced-motion`.
- Avoid perpetual animation that implies nonexistent work.

## 9. Command system

The command bar is a discoverability layer, not a free-form authority bypass.

Initially supported intents:

- Navigate to a module.
- Find a Case, Goal, mission, Opportunity, or entity.
- Open Replay Lab.
- Create a Goal.
- Start an explicitly consented mission through the existing endpoint.
- Inspect system readiness.

Unsupported natural-language actions return a clear explanation and do not mutate state.

## 10. State and error handling

Every data surface must define:

- Loading.
- Empty.
- Ready.
- Stale.
- Temporarily unavailable.
- Unauthorized.
- Validation failure.
- Kernel offline.

Safe GET requests may retry with bounded exponential backoff. Mutations never retry automatically unless the current API contract already provides idempotency. UI optimistic updates are forbidden for Kernel-authority state.

## 11. Responsiveness and accessibility

- Primary fidelity viewport: `1536 x 1024`, matching the supplied source image.
- Supported desktop widths: 1280 px and above.
- Tablet: navigation collapses; major panels reflow.
- Mobile: operational summaries and primary actions remain usable; dense graph and forensic views may use dedicated full-screen routes.
- Full keyboard navigation.
- Visible focus states.
- Semantic landmarks and accessible control names.
- No color-only status communication.
- Reduced motion support.

## 12. Testing strategy

### Unit tests

- Kernel client runtime validation.
- Error normalization.
- View-model/projection transformations.
- Command parsing and permission boundaries.
- Mission phase and status presentation.

### Integration tests

- Dashboard against an injected/test Kernel server.
- Authentication failure and reconnection.
- Cases, Goals, missions, Opportunities, Model Forge, and Replay Lab reads.
- Supported mutations with explicit confirmation.
- New Kernel projections and authorization.

### End-to-end tests

- Connect to a local test Kernel.
- Load overview from real fixtures.
- Navigate Case → Evidence → Replay detail.
- Create Goal → start consented mission → observe state.
- Inspect Opportunity and submit feedback.
- Kernel offline/recovery experience.
- Responsive and keyboard flows.

### Repository gates

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Existing `pnpm verify:first-run` baseline

The dashboard cannot weaken or bypass existing tests.

## 13. Design implementation and QA contract

The implementation phase must use the Product Design image-to-code workflow with the supplied source image as the visual target.

Before handoff, Product Design `design-qa` must:

1. Open the source image and the browser-rendered dashboard.
2. Capture the implementation at `1536 x 1024` in the same state.
3. Compare both artifacts together, not from memory.
4. Check typography, layout rhythm, tokens, image quality, copy, responsiveness, interaction states, console errors, and primary interactions.
5. Iterate until no actionable P0/P1/P2 differences remain.
6. Save the evidence and final result in project-root `design-qa.md`.

The dashboard is not complete if browser-rendered evidence is missing or `design-qa.md` is blocked.

## 14. Delivery sequence

1. Establish the dashboard application shell and design tokens.
2. Implement the typed Kernel client and secure connection flow.
3. Wire readiness and Overview with real data.
4. Wire Cases and Replay Lab read paths.
5. Wire Goals, missions, Opportunities, and Model Forge.
6. Add missing read-only Evidence, Entity, Relationship, and Graph projections.
7. Complete Knowledge and Graph screens.
8. Add truthful Automation Center for existing behaviors only.
9. Add responsive, accessibility, integration, and end-to-end coverage.
10. Run full repository verification.
11. Run iterative browser-based design QA against the supplied image.

## 15. Acceptance criteria

- `apps/dashboard` is no longer a placeholder.
- The overview renders real Kernel data and never fixture data in normal operation.
- Every existing product subsystem has a working route, a real integration, or an explicit truthful unavailable state.
- Efesto extension and dashboard converge on the same Kernel truth without direct coupling.
- Replay Lab retains forensic and ingestion safety boundaries.
- New graph/knowledge endpoints are read-only, bounded, authenticated, and tested.
- No login, cloud account, or billing is required for the local first release.
- No secrets are exposed or persisted unsafely.
- Existing repository tests and first-run verification pass.
- Browser interactions and console state are verified.
- `design-qa.md` reports `final result: passed`.

## 16. Monetization path after product proof

Authentication and billing come only after the local product proves value.

Likely packaging:

- Local: Kernel, Cases, Evidence, extension capture.
- Pro: Agent Hub, advanced graph, recurring automation, alerts, premium reports.
- Team: shared intelligence spaces and controlled collaboration, requiring a separate privacy and synchronization architecture.

This commercial layer must remain separable from local ownership and Kernel authority.
