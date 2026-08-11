## [Unreleased]

### Added
- Credential-free remote Hermes L1→L7 acceptance using a checksum-verified, runner-local Ollama runtime and reviewed tool-capable Qwen3 model identity; no founder API key or PC installation is required.
- Remote GitHub acceptance workflow for authentic Hermes v0.20 public-web L1→L7 proof, pinned to reviewed action/runtime commits and publishing only the sanitized acceptance report.
- Private local-installation product cohort for trustworthy first-Goal activation and repeat-Goal measurement without global identifiers or external telemetry.
- Deterministic design for memory quarantine and toxic-memory handling, including authority gates, append-only transition receipts, reversible recovery, startup reconciliation, and safe Replay Lab language.
- Product launch kit with the verified one-minute narrative, five-minute demo flow, founder pitch, launch-post draft, and explicit no-overclaim guardrails.
- Replay Lab authority-boundary projection and operator panel showing forbidden Kernel-owned fields without persisting or attributing rejected payload contents.
- Canonical `PROJECT_STATE.md` continuity checkpoint and `pnpm resume` command combining recovery instructions with live Git state.
- Filesystem-backed Internal Orchestrator CLI for durable task lifecycle, execution reporting, Git-evidence approval, rejection, inspection, and explicit founder gates.
- Hermes idempotency attack smoke test to verify altered payloads with reused idempotency keys are rejected without rerunning Kernel gates.
- Hermes native JSONL log extractor, sample native log fixture, and `--native-jsonl` ingestion mode for the Hermes Agent output CLI.
- Hermes Agent output ingestion CLI and sample JSON fixture for converting, signing, and submitting real-agent run exports to the local Kernel.
- Hermes Agent output adapter for converting bounded real-agent run exports into Kernel ingestion events while rejecting Kernel authority fields.
- Hermes ingestion smoke test script and signed Hermes → Internet Brain OS ingestion contract documentation.
- Storage-backed, optional local Hermes ingestion route wired into the local Kernel server behind HMAC, freshness, idempotency, local-only, and startup-reconciliation safeguards.
- Persistent Chrome extension identity allowlisting activated by pairing, with token-rotation revocation and compatibility for pre-pairing installations.
- Secure local extension pairing with an ephemeral one-use code, five-minute expiry, five-attempt lockout, extension-origin enforcement, and no long-lived token disclosure.
- Persistent private local API credentials with explicit rotation, DNS-pinned public connections, and CI production-dependency auditing with least-privilege workflow permissions.
- Authenticated local Kernel API, strict loopback/Host enforcement, extension credential setup, SSRF-safe bounded public-page fetching, and inert Obsidian rendering for untrusted captured/model text.
- Optional loopback-only Ollama Evidence summaries with structured hypotheses, limitations, model provenance, and a deterministic offline fallback that preserves raw Evidence.
- Automatic Obsidian-compatible Case, Evidence, and evidence-report synchronization after successful browser captures.
- First usable extension popup with explicit new-Case or existing-Case capture destinations and a local active-Case listing endpoint.
- Deterministic browser capture projection into local Case and Evidence records, compatible with the existing CLI store and idempotent across retries and restarts.
- Local Hephaestus HTTP receiver for browser page context, with bounded validation, durable JSONL inbox, deterministic receipts, restart-safe deduplication, and local-only defaults.
- Shared domain types for Phase 0.2: Case, Evidence, Entity, Relationship, Report, Skill, LLM, and validation helpers.
- Phase 0.3 Case Manager in `packages/kernel`, including repository abstraction, typed domain errors, lifecycle transitions, normalization, logical archiving, and defensive-copying tests.
- Phase 0.4 Evidence Manager in `packages/kernel`, including provenance-preserving creation, metadata updates, Case/Entity/Relationship links, hash validation, stale-write protection, and defensive-copying tests.
- GitHub Actions CI for frozen install, typecheck, tests, and build.

### Changed
- The bounded quiet Hermes query now mirrors the already-configured provider/model route into its exclusive temporary profile and forwards the same length-checked values as explicit CLI arguments, satisfying the pinned chat startup guard without loading user configuration.
- Authentic Hermes execution now uses the supported quiet `chat --query --max-turns` path so the reviewed four-turn cap reaches `AIAgent`; the runtime probe rejects installations that do not advertise that exact bounded interface.
- Hermes live discovery now requests URL-only findings, derives neutral candidate labels locally, accepts only the first fenced JSON payload, and repairs invalid string escapes before the unchanged strict whitelist and Kernel verification.
- Fenced Hermes JSON now receives a narrow deterministic repair for literal string controls and trailing commas before the unchanged strict field/value validation; the prompt also caps candidate field lengths.
- The frozen `internal.74` path added one-search prompting and content-free usage diagnostics; later candidates retain the one-search boundary while replacing scripted one-shot execution with an authoritative CLI turn cap.
- The bounded Qwen adapter now accepts a spaced `json` fence label and requests three to five concise, one-line JSON-escaped findings without trailing commas before applying the unchanged strict schema and authority checks.
- The bounded Qwen live prompt selects non-thinking mode for this simple discovery/formatting task, and the adapter strips only a known Qwen thinking envelope plus the already-supported JSON fence before strict schema validation; invalid output reports shape metadata rather than content.
- Non-zero Hermes and adapter exits now preserve a bounded, credential/path-redacted diagnostic through the mission failure record and sanitized live report instead of discarding provider stderr.
- Remote live proof now uses the reviewed `qwen3.5:2b` tool-capable model with a 256K model context so bounded inference can run on a GitHub CPU runner while satisfying Hermes's truthful 64K minimum; model identity and tool capability remain verified before Hermes starts.
- Remote live proof now uses one fail-closed attempt capped at four turns and two searches; normal product recovery remains three attempts, and an explicitly recorded live failure ends observation without overlapping another adapter run.
- Authentic Hermes discovery now prefers canonical directly readable public pages, avoids login/paywall/redirect/search/JavaScript shells, and uses a durable open-source-tool live Goal without weakening Evidence or Find thresholds.
- Authentic Hermes live acceptance now enforces nested adapter, worker, terminal, and job deadlines; timeout/output termination waits for the adapter process to close and escalates to a bounded forced kill before mission failure is recorded.
- Authentic Hermes search launches now use an ephemeral home and working directory, ignore user configuration/rules, disable project plugins, retain only the official `search` toolset, and redact provider-shaped credentials from acceptance diagnostics.
- The Kernel-owned product scorecard now measures local activation/repeat usage when a valid private cohort exists, fails closed on missing/corrupt cohort metadata, and surfaces Repeat Goal Usage as a primary dashboard KPI.
- README opening now explains the current AI-forensics wedge, product boundaries, and local architecture before contributor doctrine.
- Product Star roadmap and AI handoff now distinguish verified, partial, blocked, and deferred sections using the current repository evidence.
- Kernel builds now emit executable CommonJS alongside declarations, and Hermes smoke replays use a stable signed timestamp so clean-checkout runtime validation is deterministic.
- Hermes ingestion contract now documents bounded exports, native JSONL logs, both agent-output ingestion CLI modes, and idempotency attack-smoke validation.
- Hermes operating protocol now requires the signed ingestion contract and `pnpm hermes:smoke` validation for ingestion-related changes.
- Updated validation to enforce canonical ISO-8601 UTC timestamps.
- Moved test file to packages/shared/test/.
- Exported public API via index.ts.
- Added Kernel-to-Shared workspace resolution for TypeScript and Vitest.

## [0.1.0] - 2026-07-11
### Added
- Initial technical skeleton for Phase 0.1.

# CHANGELOG

All meaningful project changes should be recorded here.

## 2026-07-10

- Initialized repository purpose in `README.md`.
- Added `PROJECT_DNA.md` to define permanent identity and principles.
- Added `PROJECT_BIBLE.md` to define product model, objects, and long-term direction.
- Added `AI_CONSTITUTION.md` to govern LLM and agent behavior.
- Added `LLM_HANDOFF.md` to support continuity between Hermes, OpenCode, Codex, GPT, and other models.
- Added `ROADMAP.md` with controlled product phases.
- Added `DECISIONS.md` with initial product/architecture decisions.
- Added `AGENT_ROLES.md` to define responsibilities and boundaries across models.
- Added Phase 0 tasks and prioritized backlog.
- Added initial system architecture and local/free model strategy.
- Added Obsidian memory structure and mandatory Knowledge Sync protocol.
- Added Hermes operating protocol with model routing, stop conditions, and definition of done.
- Added institutional memory documents under `brain/`.
- Captured founder vision and long-term WOW feature concepts.
- Added strict pull request template for architecture, safety, testing, rollback, and documentation review.
- Strengthened the AI Constitution with zero-knowledge-loss, no-secret, review, and completion-gate rules.
- Updated README with mandatory reading order and company operating model.

## 2026-07-11
- Created technical skeleton for Phase 0.1: monorepo structure with apps/ and packages/
- Added base TypeScript configuration with project references
- Configured pnpm workspaces and install/test/typecheck/build scripts
- Added .gitignore for Node/TypeScript
- Added placeholder source files and tsconfig for each package
- Validation: pnpm install, typecheck, test, and build all pass
