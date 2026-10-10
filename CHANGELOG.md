## [Unreleased]

### 2026-10-10 — Pure MCP snapshots

- Read expired and historical missions without manager reconciliation or writes. Preserve all five tools, add store-integrity/error regressions, and document process/file-permission trust plus legacy token diagnostics. Candidate .92, unmerged.

### 2026-10-10 — Economic Goal searches

- Preserve the full Goal subject when intent enrichment supplies price or identifier keywords; retain bounded discovery and existing verification. Five composed regressions reproduce the old failure. Candidate .91, unmerged.

### 2026-10-08 — Historical Goal block recovery (.90, unmerged)

- Offer explicit Buscar más recovery for finished revision-mismatch blocks, with current-Goal confirmation and preserved history/Evidence/Finds. Keep other policy blocks and active leases protected.
- Retain the known denial in bounded previous-attempt metadata and avoid claiming a queued attempt from a stale client request. Keep the existing visual design. Founder requested improvements before a later merge.

### 2026-10-08 — Goal verification reliability

- Protect the Goal revision while the Kernel verifies submitted candidates, including the interval without an agent lease; incorporate PR #255's guard.
- Explain the waiting state in the existing editor, preserve typed text and re-enable saving when verification settles. Cover partial, blocked and settleable batches; add desktop/mobile browser acceptance. Candidate .89, public launch still blocked pending installed UAT.

## 2026-10-06 — Windows recovery qualification (.88)

PR #264 corrects leading UTF-8 BOM launcher metadata and CMD return handling. Initial Windows First Run and Launcher Smoke workflows passed; the strict package audit detected newly published GHSA-wq5f-xc86-pv6w in sharp 0.35.4. Pin sharp 0.35.5 and regenerate the lockfile without suppressing audits. Candidate .88 replaces frozen .87; qualify the final unchanged head before merging. Add a real Windows CMD shim regression and verify BOM metadata is read without modifying it. Founder-PC update and automatic reconnection are still pending. Public launch remains blocked.


## 2026-10-06 — Founder Windows launcher recovery

Founder-PC installation built the Kernel and extension, then failed in readJsonOptional while reading the launcher process record. A leading UTF-8 BOM is a reproduced cause; the PC file has not been inspected, so its encoding remains unconfirmed. The reader now removes only a leading BOM and still rejects malformed JSON. The CMD launcher calls pnpm with CALL so it returns to its diagnostic and pause. No state records, credentials, Evidence or user stores are deleted. Local targeted tests pass; Windows execution, remote qualification and founder-PC recovery remain pending. Rollback these two compatibility changes only. Public launch stays blocked.


### Added
- Real Chromium extension bridge acceptance covering discovery, consent, authenticated streaming reads, reopen and revocation. Pin source-map-js 1.2.2 for GHSA-68fv-2mgg-jv7q while keeping strict audit gates.
- Candidate .87: explicit Windows daily setup with reversible per-user automatic Kernel startup; approved extension-backed web reconnection without delivering a private token to the dashboard, bounded streaming transport, revocation, setup guide and startup/security regression coverage.
- Forge live mission view on Home and Objetivos: the focused Kernel mission rendered as an anvil with real candidates, Kernel web.read Evidence, SUPPORT verdicts and Finds (mobile-first at 390×844, wide anvil composition on desktop, reduced-motion still frame, honest offline/connecting/empty states). New read-only `GET /api/agent-missions/:id/evidence` projection returns bounded verbatim Evidence excerpts (never Hermes snippets, never undecoded binary).
- Canonical `CONSTITUTION.md` for Efesto's product identity, Kernel authority, safety boundaries, truthful autonomy, engineering discipline, agent preflight, and amendment process; `pnpm resume` now validates its required agent entry points before exposing the live checkpoint.
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
- Dashboard Phase 1 product IA: Home defaults to Goal, Spanish primary nav Inicio/Objetivos/Hallazgos/Evidencia/Memoria/Actividad/Ajustes, Findings as unverified leads from Kernel records, Evidence progressive provenance, honest Memory unavailable, and BLOCKED/Hermes-unavailable from Shared Goal Truth. Kernel contracts unchanged. publicLaunchApproved remains false.
- Raised the workspace `nanoid` override to `3.3.18`, clearing the production audit advisory inherited through Next/PostCSS without changing application behavior.
- Refined the draft Efesto web redesign into a professional conversation-first surface with a persistent bottom composer, real `Chat / Goal` modes, compact smith identity, direct local forge imagery, and a verified 390×844 no-overflow layout while preserving all existing Kernel action contracts.
- Internal.81 was qualified on final `main` SHA `f7a85b65f6df10ba656964cc317cb95ce8b481cb` by the complete CI/package matrix and authentic remote Hermes L1→L7 run `31686750785` (`14/14`: 14 candidates, 3 verified Evidence records and 3 Evidence-backed Finds); public launch remains blocked on manual UAT.
- Kernel candidate verification now retains and hashes the complete fetched page as Evidence while deterministically bounding only the classifier/Opportunity page-context view to 12,000 characters; live terminal observation allows 32 minutes so the bounded 25-minute inference can finish the existing maximum web-read verification batch.
- Non-JSON Hermes final responses may now contribute only deduplicated literal HTTP(S) URLs as neutral candidates; all prose is discarded and Kernel private-address, `web.read`, Evidence and classification gates remain mandatory.
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

## 2026-10-05 — Efesto reliability improvement candidate

- Preserve Kernel response-body deadlines and reject malformed/unleased worker responses instead of inventing completion.
- Reject redirects for authenticated worker/dashboard transport and distinguish dashboard body timeouts from invalid JSON.
- Recover Goal editing after save rejection, retain text, prevent duplicate submissions and contain modal keyboard focus.
- Preserve Forge v3 crawler visuals, SUPPORT and all existing private records; document qualification and rollback plan.

## 2026-10-05 — Hermes live model identity correction

- Select explicit Qwen3.5 2B Q8_0 with reviewed full SHA-256 instead of a stale 12-character alias pin.
- Reject ambiguous model metadata and missing tools before authentic Hermes acceptance. Preserve all Kernel gates and public-launch block.

## 2026-10-05 — Private source identity

- Show bundled original GitHub and VS Code marks beside Forge source domains and original Hermes favicon beside Kernel agent status.
- Add local initials fallback and exact-hostname brand matching without remote favicon services. Preserve SUPPORT, source actions, mission history and crawler behavior.

## 2026-10-05 — Preserve vault files during diagnostics

- Replace the fixed-name overwrite/delete probe with a unique exclusive owner-private temporary file. Preserve historical probe-named user files and concurrent diagnostic isolation.
- #256 and #258 integrated in main after exact-head CI, packaged Windows checks and authentic Hermes 14/14. Founder-PC UAT remains outstanding.

- Internal candidate identity advanced to `0.1.0-internal.82` for integrated Hermes model identity, source logos and vault diagnostic preservation. Previous `.81` artifacts are frozen; `.82` requires qualification on its exact commit and founder Windows UAT. `publicLaunchApproved=false`.

## 2026-10-05 — Read-only installation identity

Add `node scripts/efesto-install-identity.mjs` / `pnpm efesto:identity` to report internal version, exact checkout/archive commit and clean/modified checkout state without exposing paths, filenames, credentials or performing runtime/vault/network probes. `BUILD_COMMIT.txt` is expanded by Git archive through export-subst. Reject parent-repository identity for nested packages and keep legacy/malformed identity unknown. Identity is not authenticity or readiness; verify the package SHA256 separately. Candidate `.83` replaces frozen `.82` for this new behavior; public launch remains blocked. #259 merged as f635676 after all five workflows passed. Founder-PC UAT remains outstanding. Rollback this slice only.

## 2026-10-05 — Launcher readiness rejects redirects

Launcher health and runtime bootstrap requests use redirect:error so readiness is accepted only from a direct response at the requested endpoint. Existing timeouts, port-conflict detection and direct runtime certification remain intact. No crawler, Kernel domain, SUPPORT, credential or store changes. Real HTTP regressions cover 301/302/307/308 for both probes (8 failures before the fix) plus direct health and blocked Hermes compatibility. Candidate `.84` advances frozen `.83`. Rollback only this transport slice. #260 merged to main 7e077439 after all five workflows passed; founder Windows UAT remains unverified and public launch blocked.

## 2026-10-05 — Observable launcher stop failures

Default stopOwnedProcess now returns its stop result and removes the launcher PID record only for an accepted stop request. Failure/timeout retains the original record, returns stop_failed from shutdown/pairing repair and gives CLI exit 1. Pairing restart returns stop_not_confirmed instead of spawning a replacement when the bounded wait still reports Kernel ready. Successful stop-request and legacy injected operations remain compatible; no completed POSIX termination claim is added. No crawler, Kernel authority, SUPPORT, credential or user-store changes. Candidate `.85` advances frozen `.84`; public launch remains blocked. #261 merged as e6d407a after all five workflows passed; Windows founder-PC UAT remains outstanding. Rollback only this stop-result slice.

### 2026-10-05 — Agent connector truth
- Count waiting_for_agent missions and display completed-without-SUPPORT work as terminada sin Evidence. Candidate internal.86; public launch remains blocked.

## 2026-10-10 — internal.93 (unmerged)

- Correct usefulness elapsed time across retained retries of one Goal revision (65 minutes was incorrectly reported as 5). Preserve revision isolation, producing-mission timestamp checks and source immutability.
- Add three regressions and a proposed 30-Goal evaluation/review protocol; no live usefulness result is claimed.
- Record exact .92 automated qualification independently; .93 requires fresh qualification.

## 2026-10-10 — internal.94 (unmerged)

- Expose honest Mission Evidence verification scope: term coverage only, commercial conditions not assessed. Reject unsupported certification and preserve legacy compatibility.
- Add a collapsed mobile/keyboard-accessible disclosure on supported Forge cards and browser acceptance at 390/1280px.
- Specify future actual condition assessment; no price, stock or freshness certification is claimed.

## 2026-10-10 — Hermes rejected-output diagnostics (.95)

The adapter still rejects structured output without an array of at most twenty findings. Its failure now includes only fixed root/findings type labels and none/over_20 count categories. No payload, keys, values, URLs, private reasoning, candidates or authority are retained from a rejected result. Frozen .94 live run 38051253204 failed 8/14 before ingestion; .95 is a diagnostic improvement, not a proven malformed-output repair. Existing queued-with-lastFailure recovery is preserved. See docs/changes/hermes-output-shape-diagnostics.md; rollback this error-metadata slice only. PR #266 stays draft/unmerged and public launch remains blocked.
