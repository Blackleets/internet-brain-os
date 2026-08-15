# LLM HANDOFF

> Recovery entrypoint: read `CONSTITUTION.md` completely, run `pnpm resume`, then read `PROJECT_STATE.md` before relying on older entries in this historical handoff log.

This file lets Hermes, OpenCode, Codex, GPT, and future models continue work without losing logic. Read `CONSTITUTION.md` completely before reading this handoff or making any repository change; it is the canonical project and authority contract.

Every AI must update this file before ending a work session.

## Current project state

Status (verified 2026-07-28 from `main` = `4f81239`):
- Foundation runtime, Replay Lab forensics, Internal Orchestrator v0, deterministic Hermes preflight, and local API token hardening are stable on `main`.
- PR #103: authentic Efesto mission adapter merged (2026-07-22) — translates bounded Hermes output into Kernel execution events; it does NOT by itself prove a live external Hermes runtime.
- PR #129: fully wired Kernel Control Center merged (2026-07-28) — `apps/local-kernel` chat service, model-provider registry, authenticated `/api/*` wiring, and dashboard Kernel workspaces UI. Dashboard is presentation-only and connects to the loopback Kernel.
- PR #130: `.hephaestus/` and `.hermes/` added to `.gitignore` (2026-07-28).
- Knowledge Graph projection and a general scheduler are NOT implemented; the dashboard shows them as explicitly unavailable.
- Open work: PR #125 (design only — memory quarantine), Issues #98 (design memory quarantine) and #101 (prove Agent Hub worker with an authentic Hermes runtime).

Current phase: Product Star Phase A is blocked on a real external Hermes runtime capture for the Agent Hub worker (Issue #101). The Issue #57 ingestion acceptance is complete and must not be conflated with worker proof. Phases B and C are complete for their current read-only/local scopes.

Primary objective: close Issue #101 with real-runtime Agent Hub worker evidence (a live external Hermes connection), then proceed to the bounded memory-safety expansion without weakening Kernel authority.

## Mandatory reading order

Before doing work, read `CONSTITUTION.md` completely, run `pnpm resume`, then read:

1. `CONSTITUTION.md`
2. `PROJECT_STATE.md` after running `pnpm resume`
3. `AGENTS.md`
4. `README.md`
5. `PROJECT_DNA.md`
6. `PROJECT_BIBLE.md`
7. `LLM_HANDOFF.md`
8. `docs/architecture.md`
9. `ROADMAP.md`
10. `docs/product-star-roadmap.md`
11. `DECISIONS.md`
12. The active GitHub issue or pull request.

## Handoff template

Every AI must append a new handoff entry using this format:

```markdown
## Handoff YYYY-MM-DD - Model/Agent Name

### What I changed
- ...

### Files changed
- ...

### Why I changed it
- ...

### Tests or checks performed
- ...

### Risks / uncertainties
- ...

### Next recommended step
- ...

### Do not forget
- ...
```

## Model usage strategy

### Hermes
Role: project orchestrator and technical director.

Best for:
- Reading the repo.
- Creating task plans.
- Coordinating agents.
- Maintaining roadmap/backlog.
- Checking that work follows the Constitution.

Avoid:
- Big architecture changes without explicit review.
- Silent rewrites.

### OpenCode
Role: free/low-cost implementation worker.

Best for:
- Creating files.
- Implementing small modules.
- Writing tests.
- Running local tasks.
- Prototyping.

Avoid:
- Changing project identity.
- Rewriting the Kernel alone.
- Adding complex dependencies without justification.

### Codex
Role: code specialist.

Best for:
- Implementing features.
- Debugging.
- Refactoring.
- Writing tests.
- Reviewing diffs.

Avoid:
- Product pivots.
- Unsupported architecture decisions.

### Strong GPT/Claude/Gemini-class models
Role: high-level architect, reviewer, and reasoning engine.

Best for:
- Architecture review.
- Security review.
- Data model review.
- Complex reasoning.
- Deep synthesis.

Avoid:
- Spending expensive credits on simple boilerplate.

### Ollama/local small models
Role: cheap local execution.

Best for:
- Summaries.
- Classification.
- Note generation.
- Extraction cleanup.
- Basic tagging.

Avoid:
- Unreviewed architecture decisions.

## Human workflow

Recommended cycle:
1. Human asks Hermes/OpenCode to implement one small task from the active priority queue.
2. The AI changes the repo.
3. The AI updates `LLM_HANDOFF.md` and `ARCHITECTURE.md` if needed.
4. Human asks a reviewer to inspect the diff.
5. If approved, continue to the next task.

## Review command for future models

Use this prompt when passing the repo to a new AI:

```text
You are working on Internet Brain OS.

Before making changes, read CONSTITUTION.md completely, run `pnpm resume`, then read PROJECT_STATE.md, AGENTS.md, README.md, PROJECT_DNA.md, PROJECT_BIBLE.md, LLM_HANDOFF.md, ARCHITECTURE.md, ROADMAP.md, DECISIONS.md, and the active task file.

Your job is to continue the project without breaking its identity.

Work on only one bounded task at a time.

Before changing the Kernel, inspect the current implementation, tests, exports, and file SHA.

After finishing, update LLM_HANDOFF.md and any relevant architecture, decision, or backlog files.

Do not remove evidence-first, local-first, Obsidian-compatible, or free-first principles.
```

## Initial handoff

The project is being prepared as a repository that multiple LLMs can work on safely.

The repository now contains a technical foundation, shared domain types, evidence management, memory lifecycle primitives, and an explicit research orchestration runtime.

## Handoff 2026-07-11 - Hermes

### What I changed
- Created monorepo structure with package.json, pnpm-workspace.yaml, tsconfig.json
- Created apps/ and packages/ directory structure with placeholder READMEs
- Created packages/kernel/, packages/obsidian/, packages/shared/, packages/skills/, packages/agents/ with package.json and tsconfig.json
- Created prompts/ directory with README.md
- Fixed TypeScript project references: removed "noEmit": true from tsconfig.base.json, set up root tsconfig.json with references, and configured each package tsconfig.json with composite: true and necessary compiler options
- Added placeholder source files (src/index.ts with export {}) in each package
- Updated package.json with correct scripts and packageManager version
- Updated .gitignore to ignore tsconfig.tsbuildinfo
- Updated CHANGELOG.md, LLM_HANDOFF.md, brain/BRAIN_LOG.md, and created knowledge/agent-sessions/2026-07-11-hermes-phase-0-1-technical-skeleton.md

### Files changed
- package.json
- pnpm-workspace.yaml
- tsconfig.json
- tsconfig.base.json
- packages/*/package.json (for kernel, obsidian, shared, skills, agents)
- packages/*/tsconfig.json (for kernel, obsidian, shared, skills, agents)
- packages/*/src/index.ts (new)
- apps/extension/package.json
- apps/extension/README.md
- apps/dashboard/package.json
- apps/dashboard/README.md
- prompts/README.md
- .gitignore
- vitest.config.ts
- CHANGELOG.md
- LLM_HANDOFF.md
- brain/BRAIN_LOG.md
- knowledge/agent-sessions/2026-07-11-hermes-phase-0-1-technical-skeleton.md

### Why I changed it
To satisfy the requirements of GitHub Issue #1: Phase 0.1 — Create the minimum technical skeleton for the Internet Brain OS monorepo.

### Tests or checks performed
- pnpm install: succeeded (with warning about packageManager version format, non-blocking)
- pnpm typecheck: succeeded (exit code 0)
- Unit tests: 29/29 pass
- Build: passes

### Risks
- Evidence content references assume external storage.
- LLMRequest/LLMResponse are minimal and may need extension for provider-specific features handled in adapters.
- Validation functions throw RangeError for invalid inputs, which must be caught by callers.

## Handoff 2026-07-20 - GPT-5.5 Thinking

### What I changed
- Completed the Hermes ingestion hardening sequence through storage-backed local server wiring.
- Merged PR #52 after CI passed, enabling optional `/hermes/ingestions` in the real local Kernel server when `IBOS_HERMES_SECRET` or `HEPHAESTUS_HERMES_SECRET` is configured.
- Added a reproducible Hermes smoke test script that starts the local Kernel, checks `/health`, sends a signed Hermes sample payload, retries the same idempotency key, and verifies replay returns the same cognitive record id.
- Documented the signed Hermes → Internet Brain OS ingestion contract, including endpoint, headers, HMAC signing string, event rules, idempotency behavior, authority boundary, smoke test, and failure signals.
- Updated README and Hermes operating protocol so future contributors read the ingestion contract and run `pnpm hermes:smoke` after ingestion-related changes.
- Updated CHANGELOG with the local Hermes ingestion route and smoke contract work.

### Files changed
- `scripts/hermes-smoke-test.mjs`
- `docs/hermes-ingestion-contract.md`
- `package.json`
- `README.md`
- `docs/hermes-operating-protocol.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The system needed a reproducible test path for real Hermes ingestion after the authenticated local boundary and server route were built.
- The contract needed to be explicit so Hermes can emit accepted events without inventing Kernel authority fields.
- The smoke path protects against regressions in local server wiring, HMAC signing, idempotent replay, and Kernel cognitive record creation.

### Tests or checks performed
- PR #52 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- PR #53 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- The new `pnpm hermes:smoke` script is designed to be run after `pnpm build` because the local Kernel imports the built Kernel package.

### Risks / uncertainties
- I did not execute the smoke test inside this chat runtime; it requires the repo checkout plus dependencies/build artifacts in a local or CI runner.
- The current sample payload is synthetic. The next validation step must run an actual Hermes Agent output through the same signed path.
- The local server route intentionally remains disabled unless a Hermes secret is configured.

### Next recommended step
- Validate PR for `phase/2.9-hermes-agent-output-adapter`.
- Then add a CLI path that reads a real Hermes Agent run export JSON, converts it through `HermesAgentOutputAdapter`, signs it, and submits it to `/hermes/ingestions`.

### Do not forget
- Never allow Hermes to submit `validation`, `contradiction`, `admission`, `claim`, `candidate`, or `durableClaim`.
- For ingestion-related changes, run `pnpm build` and then `pnpm hermes:smoke`.
- The smoke script validates replay/idempotency but not yet a live Hermes provider output.

## Handoff 2026-07-20 - GPT-5.5 Thinking - Hermes Agent Adapter

### What I changed
- Added `HermesAgentOutputAdapter` to convert bounded Hermes Agent run exports into Kernel `HermesExecutionEvent[]`.
- Added authority-field rejection for embedded Kernel-owned fields such as `validation`, `contradiction`, `admission`, `candidate`, `durableClaim`, and `knowledgeAdmission`.
- Added tests for valid conversion, authority-field rejection, and claim references to unknown evidence.
- Updated the ingestion contract to document the bounded real-agent export shape.
- Updated CHANGELOG with the adapter work.

### Files changed
- `packages/kernel/src/orchestration/hermes-agent-output-adapter.ts`
- `packages/kernel/src/orchestration/index.ts`
- `packages/kernel/test/hermes-agent-output-adapter.test.ts`
- `docs/hermes-ingestion-contract.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The project needed a bridge between real Hermes Agent output and the already-secured IBOS ingestion event contract.
- The bridge must remain provider-neutral and must not let Hermes manufacture Kernel authority decisions.

### Tests or checks performed
- PR #54 CI passed before merge: typecheck, tests, and build through GitHub Actions.

### Risks / uncertainties
- The adapter expects an explicit bounded export shape. If the real Hermes Agent emits a different native structure, a thin extractor should map native logs/traces into this shape before using the adapter.
- A CLI that reads the bounded export and submits it through signed ingestion is still the next useful layer.

### Next recommended step
- Implement `scripts/hermes-ingest-agent-output.mjs` to read a real export file, adapt it, sign it, and POST it to the local Kernel.

### Do not forget
- The adapter only normalizes operational output. Kernel validation, contradiction, admission, storage, idempotency, and recovery remain Kernel-owned.

## Handoff 2026-07-20 - GPT-5.5 Thinking - Hermes Agent CLI

### What I changed
- Added `scripts/hermes-ingest-agent-output.mjs` to read a Hermes Agent run export JSON, convert it with `HermesAgentOutputAdapter`, sign the resulting ingestion payload, and submit it to `/hermes/ingestions`.
- Added `pnpm hermes:ingest-agent` command.
- Added `examples/hermes-agent-run-output.sample.json` as a runnable export shape reference.
- Updated `docs/hermes-ingestion-contract.md` with the agent-output CLI flow.
- Updated CHANGELOG with the CLI and sample fixture.

### Files changed
- `scripts/hermes-ingest-agent-output.mjs`
- `examples/hermes-agent-run-output.sample.json`
- `package.json`
- `docs/hermes-ingestion-contract.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The system needed a direct way to take real Hermes Agent output from disk and push it through the same secured local Kernel ingestion path used by the smoke test.
- This makes the next real-world validation step operational instead of theoretical.

### Tests or checks performed
- PR #54 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- PR #55 CI passed before merge: typecheck, tests, and build through GitHub Actions.

### Risks / uncertainties
- The CLI imports the built Kernel package, so `pnpm build` must run before `pnpm hermes:ingest-agent`.
- A live server with matching `IBOS_HERMES_SECRET` must be running for the CLI to succeed.
- The sample fixture is representative; a native Hermes Agent extractor may still be needed if the actual Hermes runtime emits a different log shape.

### Next recommended step
- Capture actual Hermes native output and add a thin extractor if the runtime emits logs/traces instead of the bounded JSON export.

### Do not forget
- Hermes still cannot submit Kernel authority fields.
- The CLI is only a transport client; Kernel ingestion still owns validation, contradiction, admission, idempotency, recovery, and persistence.

## Handoff 2026-07-20 - GPT-5.5 Thinking - Hermes Native JSONL Extractor

### What I changed
- Added `HermesNativeLogExtractor` to extract bounded Hermes Agent run output from explicit native JSONL operational events.
- Added tests for JSONL extraction, authority-field rejection, unknown evidence references, and invalid JSONL line errors.
- Exported the extractor through the Kernel API.
- Added `examples/hermes-native-log.sample.jsonl`.
- Extended `scripts/hermes-ingest-agent-output.mjs` with `--native-jsonl` support.
- Corrected the CLI to call `HermesAgentOutputAdapter.toExecutionEvents`.
- Updated the Hermes ingestion contract and CHANGELOG.

### Files changed
- `packages/kernel/src/orchestration/hermes-native-log-extractor.ts`
- `packages/kernel/src/orchestration/index.ts`
- `packages/kernel/test/hermes-native-log-extractor.test.ts`
- `scripts/hermes-ingest-agent-output.mjs`
- `examples/hermes-native-log.sample.jsonl`
- `docs/hermes-ingestion-contract.md`
- `CHANGELOG.md`
- `LLM_HANDOFF.md`

### Why I changed it
- The project needed a conservative path for native Hermes logs that are not already in the bounded JSON export format.
- This keeps the runtime usable with JSONL operational logs while still requiring explicit evidence and claim entries.

### Tests or checks performed
- PR #55 CI passed before merge: typecheck, tests, and build through GitHub Actions.
- PR validation for native extractor phase is pending.

### Risks / uncertainties
- The native extractor supports an explicit JSONL event shape. If Hermes emits a different console/Telegram format, another thin extractor should map that format into this JSONL contract.
- `--native-jsonl` still requires `pnpm build` and a running local Kernel server with matching Hermes secret.

### Next recommended step
- Open PR for `phase/3.1-hermes-native-output-extractor`, wait for CI, and merge if green.
- Then run the full local flow with `examples/hermes-native-log.sample.jsonl`.

### Do not forget
- The extractor must stay dumb: no inferred claims, no fabricated evidence, no Kernel authority decisions.

## Handoff 2026-08-11 - Codex

### What I changed
- Advanced the prove-value phase to G5.5 / `0.1.0-internal.63`.
- Added an idempotent local-installation cohort initialized at Kernel startup with only schema, unit and start timestamp.
- Made first confirmed Goal activation measurable for the one local installation and Repeat Goal Usage measurable only after a second distinct authorized Goal.
- Kept missing/corrupt cohort metadata fail-closed and removed the cohort timestamp from the dashboard payload.
- Surfaced Repeat Goal Usage as a primary Home KPI and local activation as supporting context.
- Updated Gherkin, UAT, architecture, roadmap, release identity and project checkpoint.

### Files changed
- `apps/local-kernel/product-cohort.mjs` and tests.
- `apps/local-kernel/product-value-scorecard.mjs`, tests and production server composition.
- Dashboard scorecard component, fixtures, parser tests and contract tests.
- `ARCHITECTURE.md`, `PROJECT_STATE.md`, `ROADMAP.md`, `INTERNAL_RELEASE.json`, UAT/product docs, Gherkin and changelog.

### Why I changed it
- The only open product issue requires business-value measurement, while Repeat Goal Usage and installation activation lacked a trustworthy local denominator.
- The founder does not want to install/download the candidate yet, so this slice prepares private pilot measurement without touching the founder PC or introducing central telemetry.

### Tests or checks performed
- Focused scorecard/cohort/HTTP/dashboard checks: 30/30 passed.
- `pnpm architecture:check`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 186 files / 1050 tests passed on the final candidate after the distinct-Goal regression was added.
- `pnpm build`: passed.
- Real temporary Kernel startup created exactly one three-field local cohort and reached listening state.
- `pnpm release:verify`: green with public launch still blocked pending UAT.
- `pnpm hermes:acceptance`: 14/14 boundary checks passed.
- `pnpm build:extension`: passed.
- `pnpm verify:first-run`: passed, including exact replay and altered-replay `409`.
- Local Playwright could not launch because Chromium is not installed; no browser was downloaded.

### Risks / uncertainties
- The `0/1` and `1/1` activation/repeat ratios describe one local installation only; they are not population retention rates.
- Chromium, Windows launcher/first-run and exact-package matrices remain to be proven in GitHub CI on the final published SHA.
- Authentic Hermes + public Internet L1→L7 and founder UAT remain separate external proofs.

### Next recommended step
- Commit the scoped `internal.63` change, publish one draft PR, require all GitHub Chromium/Windows/package workflows to pass, and merge only the unchanged green SHA.

### Do not forget
- Do not add a global user/device identifier or telemetry upload to turn a private installation observation into a fake aggregate rate.
- Do not reuse `internal.63` after its contents are published; any follow-up code/UI/package change must advance the candidate.

## Handoff 2026-08-12 - Codex - Efesto Constitution

### What I changed
- Added the canonical root `CONSTITUTION.md` as Efesto's product, authority, safety, engineering, agent-preflight, and amendment contract.
- Connected `AGENTS.md`, Hermes's operating protocol, `README.md`, `PROJECT_STATE.md`, `ARCHITECTURE.md`, `LLM_HANDOFF.md`, `PROJECT_DNA.md`, `PROJECT_BIBLE.md`, and `AGENT_ROLES.md` to the canonical constitution.
- Marked `AI_CONSTITUTION.md` as a compatibility pointer so the repository has one authority instead of two competing constitutions.
- Added `scripts/constitution-check.mjs` and its test; `pnpm resume` now validates the Constitution and nine required agent/project entry points before rendering live project state.

### Why I changed it
- The project needed one explicit Star/constitutional boundary that Hermes and every implementation worker must read before making changes, while preserving the existing continuity and handoff system.

### Tests or checks performed
- `pnpm constitution:check` — passed; nine agent/project entry points require `CONSTITUTION.md` first.
- `pnpm exec vitest run scripts/constitution-check.test.mjs scripts/project-resume.test.mjs` — 2 files / 2 tests passed.
- `pnpm architecture:check` — passed.
- `pnpm resume` — constitutional preflight passed and live checkpoint rendered.
- `git diff --check` — passed.

### Risks / uncertainties
- The preflight is a repository contract and machine check; it cannot prove that an external agent actually read a file outside the repository's documented workflow.
- No code, Kernel authority, runtime behavior, or `pids/` user change was modified.

### Next recommended step
- Review the scoped documentation and preflight diff, then commit or open the normal review change without including the unrelated `pids/` directory.

### Do not forget
- `CONSTITUTION.md` is canonical. Do not reintroduce a second governing constitution or let an agent begin work without the preflight.

## Handoff 2026-08-12 - Codex - Constitutional closure and local qualification

### What I changed
- Completed the constitutional preflight from the repository root and verified that the change remains limited to Efesto; Hermes Agent and the unrelated `pids/` directory were not modified or staged.
- Preserved the canonical constitution integration and the nine checked agent/project entry points.
- Restored the generated `apps/dashboard/next-env.d.ts` change produced by the production build so no generated runtime metadata remains in the scoped change.

### Files changed
- `CONSTITUTION.md`
- `scripts/constitution-check.mjs`
- `scripts/constitution-check.test.mjs`
- Existing constitutional entry-point documentation and `LLM_HANDOFF.md`.

### Tests or checks performed
- `pnpm constitution:check` — passed.
- Focused constitutional tests — 2 files / 2 tests passed.
- `pnpm architecture:check` — passed.
- `pnpm audit --prod` — no known vulnerabilities.
- `pnpm typecheck` — passed.
- `pnpm test` — 188 files / 1078 tests passed.
- `pnpm build` — passed.
- `pnpm verify:first-run` — passed, including Hermes smoke, altered-replay attack smoke and Replay Lab API smoke.
- `pnpm hermes:acceptance` — boundary-authority `14/14` passed.
- `pnpm build:extension` — passed.
- Sanitized Hermes sensitive-data preflight — passed.
- Workflow/release contract tests — 4 files / 16 tests passed.
- `pnpm release:verify` and `git diff --check` — passed.

### Risks / uncertainties
- Dashboard Chromium acceptance could not execute in this environment because the Playwright browser binary was absent. The temporary `/tmp` download attempt returned a truncated 0 MiB archive from the CDN; no application test ran, so this remains an environmental blocker rather than a product pass or fail.
- Authentic remote Hermes L1→L7 proof and the Windows packaged matrix still require their designated GitHub environments; deterministic local `14/14` is not a substitute.

### Next recommended step
- Commit this scoped constitutional change without `pids/`, then run the exact candidate through the designated GitHub/Chromium/Windows matrix and require the authentic sanitized `14/14` live report before promotion.

### Do not forget
- `internal.81` remains an internal candidate until the exact immutable SHA has the complete matrix and authentic public-web proof. Public launch remains blocked pending UAT.

## Handoff 2026-08-13 - Codex - Forge Command Center + mobile web

### What I changed

- Continued PR #221 for the selected Efesto visual direction.
- Moved the real Goal/Chat composer and Kernel-backed Evidence/Find context into the Forge Command Center home surface.
- Wired Home context actions to the existing Evidence and Finds workspaces without creating a second store or authority path.
- Added the responsive mobile web install surface: manifest route, viewport metadata, safe-area padding, touch targets and mobile acceptance coverage.
- Recorded the PWA-first decision: no native runtime or unsafe phone-to-PC bridge was added.

### Files changed

- `apps/dashboard/app/efesto-forge-redesign.css`
- `apps/dashboard/app/layout.tsx`
- `apps/dashboard/app/manifest.ts`
- `apps/dashboard/components/efesto-product-shell.tsx`
- `apps/dashboard/components/efesto-product-views.tsx`
- `apps/dashboard/e2e/overview.spec.ts`
- `apps/dashboard/README.md`
- `DECISIONS.md`
- `design-qa.md`

### Why I changed it

- The selected visual direction needed to become a real product surface while preserving the existing Kernel contracts.
- The founder asked for web and mobile progress without installing anything on the PC; a mobile-width/PWA web surface is implementable now, while a native app would require a new runtime and a reviewed cross-device authority contract.
- The current loopback Kernel must not be misrepresented as reachable from a separate phone.

### Tests or checks performed

- Local dashboard unit suite: 124 tests passed.
- Local dashboard production build: passed, including `/manifest.webmanifest`.
- GitHub CI on head `56731ecbb8c969d1e1a60a19f7501b6f8d55db3f`: `validate` passed.
- GitHub Internal Test Package on the same head: `package-internal-windows`, Windows 2022 and Windows 2025 packaged qualification passed.
- GitHub CI run `31707162949` passed `validate` (architecture, audit, release readiness, typecheck, full tests, build and first-run) and `dashboard-browser` (6/6 functional browser scenarios, including context navigation, mobile layout, manifest, keyboard and reduced motion).
- GitHub Internal Test Package run `31707162960` passed the exact package generation and Windows 2022/2025 packaged install-repair qualification.
- This environment still cannot launch Chromium locally because the Playwright binary is unavailable; the GitHub browser run is the functional evidence for this candidate.
- Visual screenshot comparison remains blocked and is stated in `design-qa.md`.

### Risks / uncertainties

- This is an installable mobile web surface, not a native Android/iOS app.
- A phone cannot use `127.0.0.1` to reach a Kernel running on another PC; no public proxy, token URL or remote authority was introduced.
- The selected image-to-code direction still needs a rendered screenshot comparison when a browser/preview environment is available.

### Next recommended step

- Review/merge PR #221 only if the safe decision is approved; keep the visual screenshot comparison and native mobile transport as explicit follow-up boundaries.
- After the founder can install/run Efesto on PC, define the separate secure cross-device transport contract before starting native mobile work.

### Do not forget

- Do not call the PWA surface a native app.
- Do not imply phone→PC Kernel authority.
- Do not merge the draft PR automatically.



## Handoff 2026-08-13 - Codex - Chat-first web surface

### What I changed

- Kept PR #221 web-first and refined the Home surface around the familiar ChatGPT interaction model: welcome, composer, starter prompts and live context.
- Added a distinctive Efesto identity layer through the “Intelligence Forge” eyebrow, copper/obsidian visual language and a compact Kernel-owned Forge state.
- Kept Goal and Chat in the same real composer, with explicit `aria-pressed` state and the existing submit/confirmation rules.
- Kept Evidence and Finds as real contextual navigation into the existing workspaces; no second store, fixture-only action or new authority path was introduced.

### Checks on the exact head before this documentation commit

- GitHub CI run `31708590296`: passed, including dashboard-browser.
- GitHub Internal Test Package run `31708590258`: passed.
- The new browser assertions cover the Efesto identity and Goal/Chat mode semantics.
- Screenshot comparison remains blocked in this environment; no pixel-level visual claim is made from source alone.

### Boundary

This completes the web-first design slice. Responsive mobile use is included through the existing dashboard/PWA surface, but native Android/iOS and phone-to-PC Kernel transport remain outside this PR.

## Handoff 2026-08-13 - Codex - Professional Efesto conversation surface

### What changed

- Refined PR #221 around a persistent bottom composer with a professional `Chat / Goal` selector.
- Removed visible comparison copy that named another AI product; the Home now explains Efesto, Goal preparation, Evidence and Kernel authority in its own language.
- Integrated the existing pixel smith as compact product identity in the Home, composer and live Chat header.
- Preserved the existing brain/forge asset because the living-forge state remains a release contract; its delivery is now direct/local in static previews.
- Kept every action on its existing handler: Chat streaming, Goal preparation and confirmation, starter Goals, Evidence navigation and Finds navigation.
- Tightened the 390×844 layout: no horizontal overflow, nonessential top metadata hidden, 134 px sticky composer and safe-area bottom offset.

### Verification

- Dashboard unit suite: 124/124 passed.
- Dashboard production build: passed.
- Cloud-browser desktop render: 1363×936, zero broken images and composer visible inside the viewport.
- Cloud-browser mobile render: 390×844, document width 390, composer x=12 / width=351 / bottom=822.
- Browser interaction: Chat and Goal mode semantics passed; starter Goal populated the real textarea; no app-origin console errors.
- Exact screenshot artifact persistence remains blocked by the cloud-browser export boundary and is recorded in `design-qa.md`; PR #221 must remain draft until the final CI/browser artifact is available.

### Boundaries

- No Kernel, authentication, persistence, agent, Evidence, Find, replay or memory-authority contract changed.
- No native app or phone→PC transport was added.
- Do not merge the draft automatically.

## Handoff 2026-08-14 - Codex - Efesto Complementos connector foundation

### What changed

- Added a Kernel-owned external MCP catalog for GitHub, Gmail, Google Drive,
  Notion, and Google Calendar.
- Kept every connector read-first with a narrow scope, explicit capabilities,
  independent readiness, and a real Settings action.
- Added local SVG logos and a responsive directory/icon strip in the dashboard.
- Added a Settings connector ledger so each `+` action lands on a useful,
  truthful configuration surface rather than a dead control.

### Verification

- Kernel integration-catalog tests: 3/3 passed.
- Kernel server integration tests: included in the targeted 30-test run.
- Dashboard suite: 126/126 passed.
- Dashboard typecheck: passed.
- Full repository gates: architecture check, typecheck, build and 1,086/1,086
  tests passed.
- Vercel preview deployment is `READY` for commit `d1fc5f2a40bf8436126ac78f877961d0869353c5`.

### Boundary

The connector catalog is wired to Efesto's Kernel read model, but no external
OAuth/MCP account authorization is claimed yet. The local server does not
instantiate provider connector statuses, so the five external entries remain
`not_configured` until a reviewed gateway/auth adapter reports them. Do not
mark them connected or add write scopes from the UI alone. Browser screenshot
comparison remains unavailable in this environment because a Chromium binary
is not installed.

### Next recommended step

Implement and test one real read-only adapter, preferably GitHub, with explicit
consent, bounded capability receipts, provenance, revocation, and fail-closed
status reporting; then reuse that contract for the remaining four connectors.

## Handoff 2026-08-14 - Codex - Goal Intelligence Brief

### What changed

- Added the non-mutating authenticated `POST /api/goals/plan` Kernel contract
  (`efesto.goal-intelligence.v1`).
- Reused Kernel Goal intent enrichment and added deterministic, explicit-signal
  routing for Hermes/public research, GitHub, Gmail, Google Drive, Notion, and
  Google Calendar.
- Returned required scopes/capabilities separately from active capabilities and
  kept connector readiness independent from MCP gateway readiness.
- Added the premium Intelligence Brief inside the Goal plan with intent,
  selected sources, read-only boundary, pending configuration state, and real
  Settings/Agents actions.
- Added Spanish, English, and Portuguese copy, mobile layout, reduced-motion
  handling, parser/HTTP/planner/dashboard tests, and updated the E2E fixture for
  the read-only preview request.

### Files changed

- `apps/local-kernel/goal-intelligence.mjs`
- `apps/local-kernel/goals.mjs`
- `apps/local-kernel/server.mjs`
- `apps/local-kernel/goal-intelligence.test.mjs`
- `apps/local-kernel/server.test.mjs`
- `apps/dashboard/lib/kernel/contracts.ts`
- `apps/dashboard/lib/kernel/parse.ts`
- `apps/dashboard/lib/kernel/goal-intelligence.ts`
- `apps/dashboard/components/efesto-product-shell.tsx`
- `apps/dashboard/components/efesto-product-views.tsx`
- `apps/dashboard/components/efesto-product-shell.test.tsx`
- `apps/dashboard/lib/kernel/parse.test.ts`
- `apps/dashboard/app/efesto-forge-redesign.css`
- `apps/dashboard/lib/efesto-i18n.tsx`
- `apps/dashboard/e2e/kernel-fixture.mjs`
- `apps/dashboard/e2e/overview.spec.ts`
- `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_STATE.md`

### Why

Efesto needed to feel more intelligent at the moment of decision, not by
adding decorative assistant behavior but by explaining how a Goal maps to
sources and permissions. The brief reduces tool choice while preserving
Kernel sovereignty, evidence provenance, and human confirmation.

### Verification

- Targeted planner, Kernel HTTP, parser, and dashboard tests: 53/53 passed.
- TypeScript typecheck: passed after the implementation slice.
- Full architecture check, typecheck, build, and repository test suite passed:
  190 test files / 1,096 tests.
- Vercel preview is `READY` for the published branch commit
  `74e89e43390f2e405f78ef7dd528ad2f942b2653`.
- Browser screenshot comparison remains blocked in this environment because
  the Playwright Chromium binary is not installed; the deployed HTML smoke
  check returned HTTP 200.

### Risks / uncertainties

- The planner is deterministic and bounded; it is a source-routing preview,
  not semantic model reasoning and not proof that a provider account is
  authorized.
- A running old Kernel without `/api/goals/plan` shows the explicit limited
  state and keeps the existing Goal confirmation path.
- The web preview still cannot reach a user's loopback Kernel unless the user
  opens it from a compatible local environment; the preview must not imply
  phone-to-PC authority.

### Next recommended step

Inspect the rendered desktop/mobile brief on the preview, then implement one
genuine read-only GitHub adapter behind the same source/capability/receipt
contract. Keep the adapter bounded, consented, revocable, and fail-closed.

## Handoff 2026-08-14 - Codex - Governed GitHub read-only adapter

### What changed

- Added a typed `GitHubReadOnlyClient` under `packages/connectors` with a fixed
  HTTPS GitHub API base, bounded timeout/response/list limits, GET-only
  repository/issues/pull-request/check reads, input validation, normalized
  provider data, and safe provider errors.
- Added the Kernel-owned `GitHubReadOnlyIntegration` with owner-private
  credential storage, credential verification, active-Goal authorization,
  `github.read` capabilities, 15-minute authorization expiry, explicit
  revocation, deterministic idempotent read receipts, source provenance and
  content hashes.
- Added authenticated local routes for GitHub credential status/configure/
  revoke, authorization/revoke, and bounded reads. The integration catalog and
  Goal Intelligence Brief publish GitHub as `native` only from this verified
  Kernel status. Gmail, Google Drive, Notion, and Google Calendar remain
  unchanged MCP catalog entries.

### Files changed

- `apps/local-kernel/github-readonly-contract.mjs`
- `apps/local-kernel/github-readonly-integration.mjs`
- `apps/local-kernel/github-readonly-integration.test.mjs`
- `apps/local-kernel/server.mjs`
- `apps/local-kernel/server.test.mjs`
- `apps/local-kernel/integration-catalog.mjs`
- `apps/local-kernel/integration-catalog.test.mjs`
- `apps/local-kernel/goal-intelligence.mjs`
- `packages/connectors/src/github-readonly.ts`
- `packages/connectors/src/index.ts`
- `packages/connectors/test/github-readonly.test.ts`
- `ARCHITECTURE.md`, `DECISIONS.md`, `PROJECT_STATE.md`, `LLM_HANDOFF.md`

### Verification

- Targeted provider, integration, catalog, and Kernel HTTP tests: 42/42 passed.
- `pnpm architecture:check`: passed.
- `pnpm typecheck`: passed after the implementation and export wiring.
- Full repository gates: 192 test files / 1,107 tests passed; architecture
  check, typecheck, and production build passed.
- Remote PR head: `8b477b70be2e3bb6f689c5c6a5196ecd1d089466`.
- Vercel preview is `READY` at
  `https://efesto-git-agent-premium-forge-v-093946-nfyns-projects-b0cc0f41.vercel.app`.
- Automated preview fetch is SSO-protected and returned HTTP 302; no visual
  or HTML smoke pass is claimed from that response.

### Boundary / residual risk

No live GitHub credential is available in this workspace, so the real provider
was verified through the typed client contract and deterministic HTTP fixtures,
not a live account read. Do not claim live GitHub data until an owner supplies
a read-scoped token through the local Kernel. The adapter does not yet project
GitHub receipts into the Evidence/Goal UI; that is the next bounded product
slice. Do not add write scopes or alter the other four connectors in that step.

## Handoff 2026-08-14 - Codex - GitHub Evidence journey

### What I changed

- Added the Kernel-owned GitHub Evidence projector. A verified read receipt is
  now converted into a deterministic Case and Evidence record tied to the
  active Goal, authorization, canonical repository source, operation, and
  content hash.
- Added the authenticated `/api/integrations/github/evidence` route. It reuses
  the existing bounded read path, preserves idempotent replay, optionally syncs
  the resulting Case to Obsidian, and never returns credential material.
- Added the Goal-first GitHub action: repository owner/repo, exact
  `github.repository.read` consent, read-only disclosure, Goal creation,
  authorization, Evidence projection, Case loading, and navigation to Evidence.
- Added the native GitHub Settings card with local credential verification,
  environment-managed disclosure, credential revocation, scope/capability
  visibility, local GitHub logo, and Spanish/English/Portuguese copy.
- Kept Gmail, Google Drive, Notion, and Google Calendar in their existing MCP
  catalog/read-model path; no provider writes or production deployment were
  introduced.

### Files changed

- `apps/local-kernel/github-evidence-projector.mjs`
- `apps/local-kernel/github-evidence-projector.test.mjs`
- `apps/local-kernel/github-readonly-contract.mjs`
- `apps/local-kernel/server.mjs`
- `apps/local-kernel/server.test.mjs`
- `apps/dashboard/components/efesto-product-shell.tsx`
- `apps/dashboard/components/efesto-product-shell.test.tsx`
- `apps/dashboard/components/efesto-product-views.tsx`
- `apps/dashboard/app/efesto-forge-redesign.css`
- `apps/dashboard/lib/efesto-i18n.tsx`
- `PROJECT_STATE.md`

### Why

The GitHub adapter needed a complete user-visible value path. Configuration
alone was not enough: Efesto must show exactly what the user authorizes, read
only within that scope, and make the result durable as inspectable Evidence
without allowing an external adapter or the browser to become memory authority.

### Tests or checks performed

- Native GitHub Settings and Goal → authorization → Evidence Case shell flow:
  9/9 dashboard tests passed.
- GitHub Evidence projector and Kernel HTTP route: 31/31 focused tests passed.
- Full repository gates passed: architecture check, typecheck, 193 test files
  / 1,111 tests, production build, `verify:first-run`, release readiness, and
  `git diff --check`; production is intentionally untouched.

### Risks / uncertainties

- No live GitHub credential is available in this workspace. Provider behavior is
  covered by bounded client/integration fixtures, not by a real account read.
- The preview environment is SSO-protected, so an automated fetch cannot serve
  as visual proof. The user-owned local Kernel remains the authority boundary.

### Next recommended step

The implementation is committed locally as `e1b64ce`. Publish the branch to
the existing PR and obtain a READY preview when a GitHub CLI/app path is
available; this workspace lacks `gh`, so no external push was attempted here.
Then exercise one real read-scoped GitHub token locally before adding a second
provider.

### Do not forget

Do not add GitHub write scopes, broad OAuth, automatic mission execution, or
provider-specific Evidence writes. The next provider must use the same
Goal → explicit capability → bounded read → Kernel receipt → Evidence path.

## Handoff 2026-08-14 - Codex - Evidence authority explainability and revocation

### What I changed

- Added a Kernel-owned `GET /api/integrations/github/authorizations/:id`
  status read. It returns only the public authorization receipt and derives
  `active`, `expired`, `revoked`, or fail-closed `invalid` state; provider
  credentials never enter the response.
- Attached the public GitHub authorization summary to GitHub Case detail so
  Evidence can explain its Goal, read scope, capabilities, expiry and current
  authority without sending the user back to Settings.
- Added the premium inline Evidence card with two-step revocation. Revoking
  closes future provider reads while preserving captured Case/Evidence.
- Added Spanish, English and Portuguese copy, muted closed-state styling and a
  mobile layout that keeps the authority surface readable.
- Added authenticated-route, status-transition, malformed-expiry and UI
  authorize → Evidence → confirm → revoke coverage. Gmail, Drive, Notion,
  Calendar and the MCP catalog remain unchanged.

### Verification

- Focused Kernel/HTTP/dashboard slice: 45/45 passed.
- Full repository suite: 193 test files / 1,113 tests passed.
- Architecture boundary check, typecheck and production build passed.
- `pnpm verify:first-run` passed, including Hermes validation/smoke/attack
  checks and Replay Lab API smoke.
- `pnpm release:verify` is GREEN; public launch remains blocked only pending
  manual UAT.
- Final `git diff --check` passed.

### Risks / uncertainties

- No live GitHub credential is available in this workspace. The provider path
  is contract- and fixture-verified, not proven against a real account.
- GitHub and Vercel were not updated from this workspace because `gh` and the
  `vercel` CLI are unavailable. Production remains untouched.

### Next recommended step

Exercise one real user-owned read-scoped GitHub token through the local Kernel,
confirm the Case/Evidence authority card and revocation behavior manually,
then review a second provider only if it can follow the same Goal-bound,
read-only, Kernel-receipt contract.

## Handoff 2026-08-14 - Codex - Shared connector contract and GitHub read modes

### What changed

- Centralized the five curated external connector definitions in
  `apps/local-kernel/integration-definitions.mjs` and reused them from the
  Kernel catalog and Goal Intelligence planner. This removes duplicated scope,
  capability, consent, and adapter metadata without turning definitions into
  provider readiness authority.
- Added truthful, sanitized `statusReason` records to the catalog and surfaced
  their localized explanations in the Complementos directory and Settings
  ledger. MCP gateway readiness still cannot mark an individual provider ready.
- Expanded the Goal GitHub Evidence action from repository-only to the reviewed
  bounded reads for repository, issues, pull requests, and checks. The selected
  operation determines the exact authorization capability; checks require an
  explicit branch, tag, or commit reference, and the idempotency/evidence
  payload preserves that selection.
- Added regression coverage for catalog reason sanitization, shared-definition
  parity, and the GitHub checks capability/reference request path.

### Verification

- Focused integration/planner/server/parser/dashboard slice: 66/66 passed.
- Full repository suite: 194 test files / 1,116 tests passed.
- Architecture boundary check, TypeScript, production build,
  `verify:first-run`, Hermes validation/smoke/attack checks, Replay Lab API
  smoke, `git diff --check`, and `pnpm release:verify` passed.
- Production build smoke on an isolated local port returned HTTP 200 for `/`
  and `/manifest.webmanifest`, with the Efesto identity present in the page.

### Risks / uncertainties

- No live GitHub credential was used; the provider path remains contract- and
  fixture-verified, not a live account read.
- Playwright could start its fixture/server pair after removing a stale
  generated Next lock, but all seven browser scenarios were blocked before
  launch because the environment lacks the Chromium executable. No visual
  browser pass is claimed from source or unit tests.
- Vercel/production remains untouched until the exact candidate is published;
  public launch remains blocked pending manual UAT.

### Next recommended step

Publish the verified branch through the connected GitHub path, obtain a READY
preview, then manually run one real user-owned GitHub read token through the
Goal → explicit capability → bounded read → Kernel receipt → Evidence path.
Only after that proof should another provider leave the MCP catalog-only state.

## Handoff 2026-08-15 - Codex - Premium forge candidate execution checkpoint

### What I changed

- Re-established the canonical Efesto repository and verified the active
  `agent/premium-forge-value-surface-2026-08-14` candidate.
- Recorded the exact candidate SHA, local branch relationship, fresh checks,
  runtime smoke evidence, and browser-verification blocker in
  `PROJECT_STATE.md`.
- No Kernel, Hermes, connector, authority, or UI behavior was changed in this
  checkpoint.

### Files changed

- `PROJECT_STATE.md`
- `LLM_HANDOFF.md`

### Why I changed it

The prior `internal.81` qualification belongs to an older exact `main` SHA.
The current branch contains the premium web surface, public-search fallback,
connector catalog, and GitHub read-only path, so future qualification must not
inherit the older live-proof claim without re-running the exact candidate
matrix.

### Tests or checks performed

- `pnpm architecture:check` — pass.
- `pnpm typecheck` — pass.
- `pnpm test` — 196 files / 1,131 tests pass.
- `pnpm dashboard:test` — 20 files / 139 tests pass.
- `pnpm build` — pass.
- `pnpm build:extension` — pass.
- `pnpm verify:first-run` — pass.
- `pnpm release:verify` — green; public launch remains blocked pending UAT.
- `pnpm hermes:acceptance` — 14/14 boundary-authority checks pass.
- Production dashboard smoke — `/` HTTP 200; invalid Goal plan HTTP 400.

### Risks / uncertainties

- Playwright browser UAT was blocked before test execution because the local
  Chromium executable is not installed; no visual browser pass is claimed.
- No current-branch authentic remote Hermes L1→L7 or Windows package proof is
  claimed. The existing `internal.81` proof is bound to its older exact SHA.
- External connector data remains fixture/contract-verified unless a real
  user-owned read-scoped credential is explicitly configured.

### Next recommended step

Run the exact candidate through the browser, Windows package, and remote/live
qualification gates, then execute UAT-1→UAT-6. Merge or promote only after the
same SHA has passed those gates.

### Do not forget

Keep public web preview data clearly unverified. It cannot become Evidence,
Finds, memory, or side-effect authority without the authenticated Kernel path,
source verification, provenance, and explicit Goal confirmation.

## Handoff 2026-08-15 - Codex - Candidate execution and remote verification

### Outcome

- Local implementation qualification is green at local commit
  `532d795651d407127e35a546c72eda7d1f416fee`: 199 test files / 1,144 tests,
  dashboard 20 files / 139 tests, architecture, typecheck, production build,
  extension package, `verify:first-run`, `release:verify`, and Hermes boundary
  acceptance 14/14.
- The corrected candidate code was published as
  `a457c1b61c04441ba1f989fff5bf4140e56b004a` on the active verification branch
  for draft PR #224. Draft PR #223 was closed as a duplicate and neither PR is
  merged.
- The first remote run was intentionally treated as diagnostic evidence. It
  ran on the older `4a0dcf31cc408214385c42367805a46cf6f73914` head, where CI,
  Windows first-run/package, and live Hermes checks failed while launcher smoke
  passed. The candidate includes the corresponding fixes.
- The connected GitHub API has not produced new Actions workflow runs for the
  corrected exact SHA, so remote CI/Chromium/Windows/package qualification is
  pending and must not be reported as green.

### Changed in the corrective slice

- Kept the Kernel goal resolver on a provider-neutral search port and repaired
  its typed mock contract.
- Restored semantic goal intents and Spanish planner labels/query variants;
  made resolver criteria match normalized numeric and semantic terms.
- Removed stale generated public-web connector artifacts that shadowed the
  TypeScript source.
- Added the dashboard icon route and fixed the browser test's duplicate text
  locator plus the mobile privacy-state contract.

### Release boundary

`public-launch-approval` remains `blocked-pending-uat`. Do not merge or
promote until the active PR's exact SHA has fresh CI, Chromium, Windows/package
evidence and manual UAT-1→UAT-6. No credentials, provider write scopes, or
side-effect authority were introduced.

## Handoff 2026-08-15 - Codex - Public preview relevance correction

### What changed

- The hosted web preview now converts conversational Goals into intent-bearing
  topic queries instead of searching command words such as `explica`.
- Category terms are added for focused discovery; multi-word results must match
  at least two relevant query tokens, preventing generic `oportunidades` pages
  from appearing as employment matches.
- If a focused query returns no results, the preview performs one bounded broad
  fallback and reports the actual query used. It remains read-only and never
  promotes preview data to Evidence or memory.

### Verification

- Local final qualification: 199 files / 1,147 tests; dashboard 20 files /
  141 tests; typecheck, architecture, build, extension package,
  `verify:first-run`, `release:verify`, and Hermes boundary acceptance 14/14.
- Vercel preview smoke on candidate code SHA
  `76caa35e5b56eecc3e6239b1d93df3c1c9ffd2a6` passed: Bitcoin returned six
  relevant sources; remote work returned two employment sources; Chat returned
  a truthful read-only preview response.
- No credentials, persistence, provider writes, or external side effects were
  introduced by this slice.

### Remaining gate

The connected GitHub API still has not emitted fresh Actions runs for the
updated PR head. Exact-SHA CI/Chromium/Windows/package qualification and
manual UAT-1→UAT-6 remain mandatory before merge or public promotion.

### GitHub verification trigger — 2026-08-15

The candidate PR is ready for review at the exact head of the verification branch. This documentation-only checkpoint does not change product behavior; it exists to produce a normal synchronized PR head for the release matrix.
