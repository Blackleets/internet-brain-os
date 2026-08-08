# ROADMAP

Internet Brain OS / Hephaestus grows in controlled phases. Do not bypass Kernel authority to accelerate product work.

## MVP completion status — 2026-08-08

The core local-first Efesto MVP completion gate is now focused on a bounded autonomous value loop:

```text
Goal → Plan → Capability/Risk Gate → Execution → Evidence → Opportunity/Knowledge → Trigger → Notification
```

with durable controlled-memory authority behind the same Kernel boundary.

### Phase 0 — Minimum Kernel ✅

- Case and Evidence models.
- Local storage and public-page ingestion.
- Obsidian-compatible export/reporting.
- CLI/local runtime and regression tests.
- No paid cloud service required for the baseline.

### Phase 1 — Browser Extension Copilot ✅

- Chrome/Chromium MV3 extension.
- Authenticated loopback Kernel transport.
- Public page context capture with privacy blocks.
- Forge/Missions/Finds/Models operator workspaces.
- Opportunity Radar and explicit per-site authorization.

### Phase 2 — Modular intelligence foundation ✅

- Shared Skills package and evidence-producing skill contracts.
- Capability Registry and deny-by-default capability validation.
- Native public `web.search` and `web.read` capability adapters.
- Execution Engine routes capability use through Kernel policy rather than direct agent authority.

### Phase 3 — Knowledge and reusable context ✅ foundation

- Entity and relationship domain support.
- Knowledge Graph service and evidence links exist in the Kernel.
- Goal-relevant opportunity/context reuse is implemented.

The graph remains a local Kernel projection; do not invent graph data in UI. A richer product graph browser is future UX, not a prerequisite for the current MVP release gate.

### Phase 3.5 — Memory Safety and Quarantine ✅ core authority

Goal: prevent unsupported, contradicted, corrupt or revoked durable memory from silently re-entering reasoning.

Verified core authority:

- [x] Deterministic quarantine/toxic-memory lifecycle design.
- [x] Observed records separated from interpretation, recommendations and human decisions.
- [x] Approval-gated transitions bound to approval/policy context.
- [x] Rejected, superseded and revoked authority states remain terminal.
- [x] Pure lifecycle types and transition validation.
- [x] Append-only authority receipts with request binding, replay semantics and integrity checks.
- [x] Fail-closed transactional transition service.
- [x] Deterministic authority-state projection.
- [x] Startup reconciliation and reasoning retrieval gate.
- [x] Durable on-disk authority receipt repository with restart reconstruction.
- [x] Corrupt/tampered/gapped/missing-reference authority histories fail closed.
- [x] Exact replay is safe and altered replay is rejected.
- [x] Legacy migration is explicit/reviewed rather than automatic admission.

Additional specialized recovery-review UX can evolve later without weakening the completed core authority boundary.

### Phase 4 — Monitoring, scheduling and alerts ✅ foundation

- Scheduler Engine exists as a Kernel primitive.
- Trigger Engine supports bounded conditions including new-match flows.
- Notification Gateway provides deduplication and Evidence linkage.
- Golden E2E proves Goal → discovery → Evidence → Opportunity → Trigger → Notification.

Future work may add richer recurring product UX and additional condition types; these are extensions of the existing authority model, not permission for direct agent side effects.

### Phase 5 — AI overlay and operator experience ✅ MVP surface

- Opportunity ranking and explainable relevance.
- Evidence-first Find details.
- Control Center with authenticated local workspaces and private multi-model chat.
- Pixel forge activity driven only from persisted/observable states.
- Dedicated Chromium/Playwright acceptance is part of CI.

### Distribution ✅ Windows MVP

- Double-click `Install Efesto.cmd` setup/repair path.
- Automatic Node.js 22+ and pinned pnpm prerequisite repair when Windows Package Manager is available.
- Frozen-lockfile dependency install, extension build and trusted Kernel launcher repair/start.
- Owner-local desktop shortcut and self-healing daily launcher.
- No embedded or printed Kernel secrets.

### Supply-chain gate ✅

- Frozen lockfile required.
- `pnpm audit --prod` runs without GHSA ignores.
- Patched `nanoid@3.3.17` is locked; vulnerable `3.3.16` is regression-blocked.
- Typecheck, tests, production build, first-run verification and Chromium acceptance are mandatory.

## Deliberately outside the MVP completion claim

These are possible later phases, not missing “yellow lights” in the current release:

- automatic purchases or irreversible financial actions;
- broad email/calendar/commerce connector catalog;
- public Skill/agent marketplace;
- multi-tenant cloud brain or central telemetry;
- native mobile application;
- social/feed/token/blockchain layers;
- a decorative graph UI without real Kernel-backed data.

## Next product phase — evidence-led expansion

Choose the next bounded workflow from real user value. Preferred candidates extend the proven local loop, for example freelance opportunity discovery or another read-only research connector. Every new capability must declare risk, scope, consent, credentials, rate limits and execution policy in the Kernel Capability Registry.
