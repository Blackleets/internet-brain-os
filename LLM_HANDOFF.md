# LLM HANDOFF

## 2026-10-10 — Economic Goal query context (candidate .91)

PR #266 remains draft and unmerged on improve/efesto-blocked-goal-recovery. Its prior recovery remains intact. Discovery now combines title and keywords instead of replacing the subject with inferred prices/identifiers; the primary query retains the full authorized title. Five composed regressions fail before the fix and pass after; adapter suite 52/52. Candidate .91 supersedes .90; publicLaunchApproved=false. Scope/rollback: docs/changes/goal-query-context.md. Full exact-head qualification and founder-PC UAT remain pending. Next bounded slice: pure MCP reads for expired/historical missions; then qualify the final candidate. Main stays 4e846763114b076fb835287571fc9647c214353c.


## 2026-10-08 — Historical Goal block recovery (candidate .90, unmerged)

Founder instruction: improve first, merge later. Do not merge this branch until the founder explicitly instructs it. Main baseline 4e846763114b076fb835287571fc9647c214353c already includes PR #265: five successful workflows, 35 Chromium tests and authentic Hermes 14/14. That proof belongs to .89, not this candidate.

Branch improve/efesto-blocked-goal-recovery exposes the existing interactive Buscar más action for a finished running/verifying mission blocked by authorization_revision_mismatch, without a live lease or automatic policy block. A fresh current-Goal authorization comes from the existing Kernel endpoint; denied candidates are not replayed. Archive the known denial with the previous attempt and preserve Evidence/Finds. The success message acknowledges the request without claiming a new queued attempt when an active mission or offline agent was returned. Preserve design and authority boundaries. See docs/changes/blocked-goal-recovery.md.

Local qualification: 276 Vitest files / 1868 tests, architecture guard, root/dashboard types production build, strict production audit, 7 SQLite tests, extension packaging and Hermes/replay smoke checks passed. Exact-head remote browser/Windows qualification remains pending. Keep the PR draft/unmerged, production and the founder updater unchanged. Founder-PC reconnection and authentic installed UAT remain unverified; publicLaunchApproved=false. Roll back only this slice; no data rollback.


## Handoff 2026-10-08 — Goal edit verification reliability

Founder requested continuing Efesto improvements and avoiding lost session context. Canonical checkout main 8d56cf89f9292bf67b1ee9b696e0560f69049082; new branch fix/efesto-goal-verification-edit. Incorporates PR #255's two-file fix with authorship retained and adds pending-verification copy to the existing editor, partial/settleable regression coverage, mobile/desktop Playwright acceptance and candidate .89. No redesign, migration, provider, SUPPORT or authority change. Historical policy-blocked missions are not repaired automatically.

Checks: architecture, types, release contract, strict production audit, 276 Vitest files / 1864 tests, production build and 7 SQLite tests passed. Main without the guard fails two new Kernel regressions. Local Chromium install failed with a truncated archive; remote exact-head CI is the browser/Windows gate. Preserve the same candidate SHA while qualifying. Founder-PC startup, reconnection and authentic Goal UAT are pending; publicLaunchApproved=false. Details and rollback: docs/changes/goal-edit-verification-reliability.md. Do not restart cosmetic work or claim the user's PC is repaired. Finish qualification and review before integrating; then continue the installed UAT gate.

## 2026-10-06 — Windows recovery qualification (.88)

PR #264 corrects leading UTF-8 BOM launcher metadata and CMD return handling. Initial Windows First Run and Launcher Smoke workflows passed; the strict package audit detected newly published GHSA-wq5f-xc86-pv6w in sharp 0.35.4. Pin sharp 0.35.5 and regenerate the lockfile without suppressing audits. Candidate .88 replaces frozen .87; qualify the final unchanged head before merging. Add a real Windows CMD shim regression and verify BOM metadata is read without modifying it. Founder-PC update and automatic reconnection are still pending. Public launch remains blocked.


## 2026-10-06 — Founder Windows launcher recovery

Founder-PC installation built the Kernel and extension, then failed in readJsonOptional while reading the launcher process record. A leading UTF-8 BOM is a reproduced cause; the PC file has not been inspected, so its encoding remains unconfirmed. The reader now removes only a leading BOM and still rejects malformed JSON. The CMD launcher calls pnpm with CALL so it returns to its diagnostic and pause. No state records, credentials, Evidence or user stores are deleted. Local targeted tests pass; Windows execution, remote qualification and founder-PC recovery remain pending. Rollback these two compatibility changes only. Public launch stays blocked.


> Recovery entrypoint: read `CONSTITUTION.md` completely, run `pnpm resume`, then read `PROJECT_STATE.md` before relying on older entries in this historical handoff log.

This file lets Hermes, OpenCode, Codex, GPT, and future models continue work without losing logic. Read `CONSTITUTION.md` completely before reading this handoff or making any repository change; it is the canonical project and authority contract.

Every AI must update this file before ending a work session.


## 2026-10-06 — PR #263 qualification follow-up

Active daily-start integration: #263, `feat/efesto-daily-start`, includes #257. First published tree passed 276 files / 1858 tests, typecheck, dashboard build and extension packaging locally. Remote first-run Windows acceptance and the existing pairing/port-conflict jobs passed. Windows startup registration/removal passed, but its expected foreign-owner rejection caused NativeCommandError in the test harness; use a captured subprocess exit code for that negative test. Strict audits also found GHSA-68fv-2mgg-jv7q in source-map-js 1.2.1: pin the patched 1.2.2 without suppressing audits. Add real Chromium extension discovery/consent/proxy/revocation coverage to dashboard browser CI. Local Chromium download was blocked by an invalid/truncated archive, so the browser test requires remote CI qualification. Final unchanged-head checks and founder-PC UAT remain pending; do not infer green from an older commit.

## 2026-10-05 — Daily startup and web reconnection (candidate .87)

The founder requested automatic Windows startup and opening Efesto without repeated token entry. `Setup Efesto Daily.cmd` enables a reversible per-user Startup shortcut after installation. A noninteractive launcher starts only an offline Kernel and preserves healthy instances and foreign processes. The paired extension can explicitly authorize the canonical production root page, then proxy bounded dashboard requests without handing its credential to the web. Revocation cancels active requests; Kernel authority and mission confirmations stay unchanged.

See [daily setup](docs/efesto-daily-start.md), [security change request](docs/changes/efesto-daily-start.md) and `tests/acceptance/efesto-daily-start.feature`. This candidate includes unmerged #257 at `445b5f0`; main remains `34c1eea` at implementation time. #257's updated-head workflows ended unsuccessfully with multiple jobs cancelled before execution; the successful browser job and older green head do not qualify .87. Final-head Windows/browser CI and founder-PC login/reconnection acceptance are separate checks. No installation on the founder PC or production deployment is claimed. `publicLaunchApproved=false`. Local validation on 2026-10-06: 276 test files / 1858 tests, root/dashboard typecheck, production build and extension packaging passed.

## Current project state

> Superseded snapshot: the status block below is historical (2026-07-28). `PROJECT_STATE.md` is the live checkpoint; as of 2026-09-28 the active PR is #241 (OPEN, not merged) and `publicLaunchApproved` remains false.

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

## Handoff 2026-08-29 - Grok - Efesto Phase 1 product IA

### What I changed
- Home defaults to Goal mode. Example chips fill the composer and do not POST.
- Primary nav: Inicio, Objetivos, Hallazgos, Evidencia, Memoria, Actividad, Ajustes.
- Findings labeled as unverified leads. Evidence progressive provenance. Memory honest unavailable. BLOCKED from Shared Goal Truth.
- Kernel not rewritten. Dashboard parses mission.blockedReason.

### Tests or checks performed
- Unit 22 PASS. architecture:check PASS. tsc -b PASS. Dashboard Vitest 130 PASS. Build PASS. Playwright e2e 6/6 PASS.

### Risks / next
- publicLaunchApproved remains false. No UAT or live Hermes L1-L7 claimed. Phase 2 Memory polish only after Phase 1 stays green.

## Handoff 2026-09-28 - Grok (EFESTO) - PR #241 hardening

### What I changed
- PR #241 (branch `fix/extension-kernel-supported-find-notify`, OPEN, never merged by agents) gained tested hardening: extension sender gate, trusted-context token storage, single-flight watchtower, bounded Site Radar memory; Kernel 400 on malformed path ids, 503 on a full event stream, chat stream settles on disconnect, one-click proxy streams SSE/NDJSON, serialized chat/provider stores, 198.18.0.0/15 and 192.0.0.0/24 rejected at candidate intake and web.read; dashboard anti-framing headers, visible-only polling, offline marking after failed polls, Case re-read on open.
- `pnpm hermes:acceptance` boundary probes were stale since #238 (they posted bare findings the Kernel now refuses). They now target `resultKind: 'search_candidates'` and a guard test runs the suite in `pnpm test`.
- Live l1-l7 reports tag runs where only L5/L6 fail as `live-no-supported-find` (reporting only; still NOT PROVEN).

### Tests or checks performed
- `pnpm hermes:acceptance` — boundary-authority `15/15` passed (earlier `14/14` entries above predate #238 and the added A10 check).
- `pnpm test`, `pnpm typecheck`, `pnpm dashboard:test`, `pnpm release:verify`, `pnpm architecture:check`, `pnpm build`, `pnpm build:extension` — passed.

### Risks / next
- Live L5/L6 (Kernel SUPPORT Find on the live web) still fails intermittently; not a pipeline failure and not weakened.
- No UAT or live Hermes L1-L7 success is claimed. `publicLaunchApproved` remains false.

## Handoff 2026-10-03 - Grok (EFESTO) - PR #241 after #243

### What I changed
- Root cause of the intermittent live L5/L6 failure: a page that passed Kernel SUPPORT was dropped by the lead classifier (score/regex), so the Mission forged with zero Finds. SUPPORT-passing Mission pages now always become a Find (`promotedBy: 'kernel_support'`); pages that fail SUPPORT still create no Find. Shipped to `main` via PR #243 (`f225af0`) and merged into PR #241 with a normal merge commit.
- Live l1-l7 reports print VERIFY lines and use `live-supported-find-dropped` (SUPPORT passed, Find missing: pipeline bug) vs `live-no-supported-find` (nothing passed SUPPORT: live-web variance).
- Hermes worker: every Kernel request has a timeout (`requestTimeoutMs`, default 60 s); a failed failure-report POST keeps the original cause (`reported: false`, `reportError`).
- Dashboard: a verifying Mission whose verification finished with zero Kernel SUPPORT shows `Sin SUPPORT` (neutral) instead of `Verificando Evidence` forever; all-fetch-failed batches keep `Verificando`. Kernel state unchanged.

### Tests or checks performed
- `pnpm typecheck`, `pnpm test`, `pnpm dashboard:test`, dashboard build, `pnpm audit --prod` passed before each push. Live l1-l7 CI runs `37127265497` and `37128263854` passed 14/14 (CI evidence only).

### Risks / next
- Live search variance can still make L5/L6 fail honestly; the failure class now says which kind.
- No UAT is claimed. `publicLaunchApproved` remains false. PR #241 stays OPEN for owner review.

## Handoff 2026-10-03 - Grok (EFESTO executor) - Forge live view

### What I changed
- Dashboard Forge live view (`components/forge/*`, `lib/forge/forge-model.ts`, `app/efesto-forge-live.css`) mounted on Home (while a Kernel mission exists) and Objetivos (all states), plus mobile shell polish of the Home bar/composer.
- Kernel read-only `GET /api/agent-missions/:id/evidence` (`apps/local-kernel/mission-evidence-reader.mjs`): Mission-linked verified Evidence with SUPPORT decision and a bounded verbatim excerpt chosen from goal-term prose (page chrome and undecoded binary are never quoted).

### Tests or checks performed
- `pnpm architecture:check`, `pnpm typecheck`, `pnpm test`, `pnpm dashboard:test`, `pnpm dashboard:build`, `pnpm audit --prod`, dashboard Playwright (existing + `e2e/forge.spec.ts` at 390×844 and 1280×800).

### Risks / next
- Not UAT. Real-Kernel screenshots used manually submitted candidates via the agent result contract, not the Hermes runtime. `publicLaunchApproved` remains false.
- Observed outside this branch's scope: the SUPPORT gate passed docs.python.org classes tutorial for Goal "Rust lifetimes explained" (title word "explained" counted as a goal term; "rust" absent); Kernel web.read stored python.org homepage `rawText` as undecoded binary; some stored page titles keep HTML entities.


## Handoff 2026-10-05 - Codex Efesto reliability review

### What I changed
- Started from latest PR #252 head a258ca3 (including #251 Forge v3), not stale main. Founder authorized additive autonomous improvements without deleting existing behavior/data.
- Preserved worker response-body deadlines, rejected malformed/unleased claim responses before adapter execution, and required same-mission persisted confirmation before submission success.
- Rejected redirects for authenticated worker and dashboard JSON/NDJSON calls; preserved dashboard body timeout classification.
- Recovered Goal editing after rejected/unconfirmed saves with retained text and safe alerts, single-flight submission, read-only pending input and keyboard focus containment.
- Added unit, browser and Gherkin regressions plus a detailed improvement/qualification plan.

### Files changed
- apps/local-kernel/hermes-mission-worker.mjs and its test.
- apps/dashboard/lib/kernel/client.ts and its test.
- apps/dashboard/components/forge/goal-edit-sheet.tsx and its test; e2e/forge.spec.ts.
- docs/efesto-improvement-plan-2026-10-05.md; tests/acceptance/efesto-recoverable-transport.feature.
- PROJECT_STATE.md, ARCHITECTURE.md, CHANGELOG.md, DECISIONS.md and this handoff.

### Why I changed it
- Prevent unbounded or falsely successful transport states and allow safe recovery from failed Goal saves while preserving the working Forge.

### Tests or checks performed
- Pinned pnpm 11.11.0 frozen-lockfile install; no dependency/lockfile change.
- Focused final regressions: 45/45 passed.
- Final full suite: 267 files / 1789 tests passed.
- Typecheck, architecture guard, release-readiness contract, production dashboard build and extension build/package passed.
- Strict production audit: no known vulnerabilities.
- SQLite persistence: 7/7 passed; Hermes smoke, altered-replay attack smoke and Replay Lab API smoke passed.
- Local Chromium download failed repeatedly with invalid/truncated ZIP; no local browser pass is claimed. Existing CI browser suite now includes desktop/mobile dialog Tab containment checks.

### Risks / uncertainties
- main, the hosted dashboard and the founder's Windows installation are not updated by this candidate branch.
- New browser/Windows CI and exact-package UAT must be checked against the published SHA. Synthetic and smoke tests are not authentic Hermes or manual UAT.
- Local runtime records used by tests were isolated; no founder store was accessed or migrated.

### Next recommended step
- Verify this PR's exact-SHA CI/browser/Windows/package runs, then integrate only the qualified candidate through the existing stack. Follow docs/efesto-improvement-plan-2026-10-05.md for exact-installation UAT and measured next improvements.

### Do not forget
- The crawler/spider/anvil/canvas, packages/kernel/src/evidence/support.ts, memory authority, query selection and existing records are unchanged. No new dependency, paid service or authority. publicLaunchApproved remains false. Rollback is a revert of this improvement commit; do not revert the #252 baseline.

## Handoff 2026-10-05 — Codex live model identity

- Base main 79ebdb1 (#254 merged), branch fix/efesto-live-model-identity. Founder requested autonomous continuation.
- Confirmed failed run 37297333680 job 111721560210 stopped at model provisioning; build and live acceptance skipped. Registry manifest for explicit qwen3.5:2b-q8_0 hashes to 0689d44085e06d165161a8a9a1731344278cfb5aade63a3c3dbdb48ab54b130a. Its model/projector layer IDs match the failed download.
- Replaced mutable alias/short pin with explicit variant/full digest, added tested fail-closed metadata verifier and updated current state. No crawler, SUPPORT, user store or authority edits.
- Validate focused tests, full suite, architecture, types and build; publish correction as PR and inspect exact-SHA workflows. New artifact tools/inference and real L1-L7 remain unproven until that run. Windows installation/UAT and source/agent logos remain outstanding; publicLaunchApproved=false.
- Rollback: revert this correction, preserve #254. No claim of founder-PC control or installation.

### Fresh local validation for the identity correction

- Focused tests 15/15; full Vitest 268 files / 1799 tests passed.
- Typecheck, production build, architecture, constitution and release-readiness checks passed. Generated next-env.d.ts change was restored.
- Full live inference, exact-SHA CI/browser/Windows/package checks and installed-PC manual UAT are separate and still pending.

### Publication authorization

- Founder explicitly authorized publishing fix/efesto-live-model-identity to Blackleets/internet-brain-os and opening its PR on 2026-10-05. The prior automatic push rejection is resolved by that authorization. Exact-SHA CI and live acceptance must still be reviewed; publication does not certify the Windows installation or public launch.

## Handoff 2026-10-05 — Source logos after authentic Hermes qualification

- #256 exact head 4026455: CI 37318713328, package 37318713368 and authentic Hermes 37318713439 succeeded. Read job 111791968962: full reviewed digest/tools passed; L1-L7 14/14, attempt=1, 7 candidates/Evidence, 5 SUPPORT Finds with fetched provenance. Not Windows UAT.
- Follow-on improve/efesto-source-logos starts from origin/fix/efesto-live-model-identity (same tree as locally validated correction). Uses repository Efesto Product UI contract.
- Added locally served original GitHub/VS Code/Hermes identity assets with URL/hash provenance, exact parsed host lookup, local failure fallback, and source/agent integration. No crawler, SUPPORT, store, provider or authority changes. Unit and desktop/mobile browser regressions cover brand spoofing, fallback and no remote icon requests.
- Next: qualify this UI slice, integrate qualified PRs through the existing review flow, then exact-installed Windows UAT. Other source/agent brands require real assets/adapters; do not claim every brand or Muse is integrated. publicLaunchApproved=false.

### Source identity validation

- Focused source/Forge/connector tests 34/34 passed; full suite 269 files / 1811 tests passed. Typecheck, architecture, release-readiness and production build passed.
- Local browser run could not launch: Chromium headless shell is not installed. No browser pass is claimed; added desktop/mobile local-network-only assertions await exact-SHA CI. Generated next-env and next dev agent files were excluded from the change.

## Handoff 2026-10-05 — Integrated baseline and vault preservation

- Integrated #256 as 685f1d5, then #258 as 60aded6, using expected exact-head guards and normal merges; no branches removed. Main tree matches the validated logo candidate.
- #258 CI 37321018834 and package 37321019367 passed (32 browser tests, exact-package Windows 2022/2025 install-repair). Live 37321019144 job 111799808879 passed 14/14 with 4 candidates/verified Evidence, 2 SUPPORT Finds, attempt=1 and fetched provenance. No installed-PC UAT or public launch claimed.
- New branch fix/efesto-vault-probe-preservation starts from main 60aded6. During installation diagnostic review, found probeObsidian overwrites/removes fixed .efesto-write-test. Corrected with UUID name, exclusive owner-private open and owned-handle cleanup; no crawler, SUPPORT, domain authority, secrets or store changes.
- Scoped target: scripts/efesto-bootstrap.mjs, vault regression tests/Gherkin and continuity docs. Risk: temporary cleanup can truthfully fail if vault IO fails; rollback is this slice only. Diagnostic performs a temporary write, so do not call existing launcher status read-only.
- Founder Windows installation still inaccessible from this execution environment; diagnose actual PC identity before updating. publicLaunchApproved=false.

### Fresh preservation validation

- Focused bootstrap/launcher checks 31/31 before adding the explicit collision case; final vault regression 4/4. Full suite 270 files / 1815 tests passed, including that collision test.
- Typecheck, production build, architecture, constitution, release-readiness and diff checks passed. No dependencies changed. Windows CI/package qualification remains required for the published preservation head.

- Internal candidate identity advanced to `0.1.0-internal.82` for integrated Hermes model identity, source logos and vault diagnostic preservation. Previous `.81` artifacts are frozen; `.82` requires qualification on its exact commit and founder Windows UAT. `publicLaunchApproved=false`.

## 2026-10-05 — Read-only installation identity

Add `node scripts/efesto-install-identity.mjs` / `pnpm efesto:identity` to report internal version, exact checkout/archive commit and clean/modified checkout state without exposing paths, filenames, credentials or performing runtime/vault/network probes. `BUILD_COMMIT.txt` is expanded by Git archive through export-subst. Reject parent-repository identity for nested packages and keep legacy/malformed identity unknown. Identity is not authenticity or readiness; verify the package SHA256 separately. Candidate `.83` replaces frozen `.82` for this new behavior; public launch remains blocked. #259 merged as f635676 after all five workflows passed. Founder-PC UAT remains outstanding. Rollback this slice only.

Validation for identity slice: focused 9/9, full 271 files / 1820 tests; typecheck, production build, architecture, constitution, release checks and diff check passed. Exact published ZIP identity and Windows install/repair await new-head CI. Local test proves export-subst archive identity; no Windows or founder-PC pass is claimed. No dependencies added.

## 2026-10-05 — Launcher readiness rejects redirects

Launcher health and runtime bootstrap requests use redirect:error so readiness is accepted only from a direct response at the requested endpoint. Existing timeouts, port-conflict detection and direct runtime certification remain intact. No crawler, Kernel domain, SUPPORT, credential or store changes. Real HTTP regressions cover 301/302/307/308 for both probes (8 failures before the fix) plus direct health and blocked Hermes compatibility. Candidate `.84` advances frozen `.83`. Rollback only this transport slice. #260 merged to main 7e077439 after all five workflows passed; founder Windows UAT remains unverified and public launch blocked.

Local `.84` validation: 35 related tests passed; full 272 files / 1830 tests passed; typecheck, production build, architecture, constitution, release-readiness and diff checks passed. Generated next-env change restored. The new candidate requires fresh remote CI, packaged Windows matrix and live Hermes; founder-PC UAT remains outstanding.

## 2026-10-05 — Observable launcher stop failures

Default stopOwnedProcess now returns its stop result and removes the launcher PID record only for an accepted stop request. Failure/timeout retains the original record, returns stop_failed from shutdown/pairing repair and gives CLI exit 1. Pairing restart returns stop_not_confirmed instead of spawning a replacement when the bounded wait still reports Kernel ready. Successful stop-request and legacy injected operations remain compatible; no completed POSIX termination claim is added. No crawler, Kernel authority, SUPPORT, credential or user-store changes. Candidate `.85` advances frozen `.84`; public launch remains blocked. #261 merged as e6d407a after all five workflows passed; Windows founder-PC UAT remains outstanding. Rollback only this stop-result slice.

Local `.85` validation: 32 related tests passed (10 stop-failure/CLI regressions); full 273 files / 1840 tests passed. Typecheck, production build, architecture, constitution, release-readiness and diff checks passed. Generated next-env change restored. No dependencies added. New-head CI/package/live qualification and founder-PC UAT remain unverified at publication.

## 2026-10-05 — Agent connector waiting count and SUPPORT truth

Candidate `.86` integrates #257 with main `34c1eea`. The read-only agent-presence projection counts queued/waiting_for_agent missions, excluding terminal missions. It emits forged only for a completed forged mission with a persisted supported verification result and nonempty Evidence identifier; other completions are completed_without_forge. Dashboard copy maps both this phase and legacy completed to terminada sin Evidence. No executor, crawler, SUPPORT admission, authentication or persistence changes. Rollback only this projection/copy slice. Public launch remains blocked; exact-candidate automated qualification and founder-PC UAT are distinct gates.

Local qualification: 23 focused tests, 273 files / 1842 tests, types, architecture, constitution, release contract and clean-cache production build passed. Initial Turbopack persistence-cache panic was resolved by replacing only local generated .next cache; no product code fix. Remote checks on the final unchanged SHA remain required.
