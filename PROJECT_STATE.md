# HEPHAESTUS — Current Project State

Canonical short checkpoint. GitHub `main`, live CI and the active PR are authoritative when newer than this file. This checkpoint preserves **machine-checkable release readiness** language required by continuity and release gates.

## Recovery

```bash
pnpm resume
```

Then read `PROJECT_STATE.md`, `AGENTS.md`, `ARCHITECTURE.md` and the active GitHub item. Work only in `Blackleets/internet-brain-os`; never mix AEGIS, Genesis HQ, APO, Hermes Agent or another project into this tree.

## Identity and authority

- Product: **HEPHAESTUS / Efesto — The Intelligence Forge**.
- Hermes and other agents discover, research and propose. **An agent is never the Kernel.**
- Hephaestus owns Evidence, validation, capability/risk gates, contradiction handling, replay, durable-memory authority and controlled persistence.
- Dashboard, extension and Replay Lab are clients/read models; Replay Lab remains read-only over memory authority.
- Exact replay is safe/idempotent; altered replay is rejected; malformed/corrupt authority fails closed.
- Automatic G4 authority is limited to explicitly authorized R0 `web.search` and `web.read`; purchase, login, forms, messages, file mutation, payments and durable-memory admission remain separately approval-gated.
- Search snippet/agent text ≠ Evidence.
- Responsive mobile-width support does not imply phone → PC Kernel authority.

## Verified foundation ✅

### Memory Safety v1

PR #201 froze adversarial Memory Safety v1 at `dff2c2167fd16ad609dd5042ca61ee588d1f7de2`.

### Goal-first product surfaces

- PR #202 / G0: **Goal-first shell**, Forge Focus and one Kernel-owned persisted Goal truth.
- The **living-forge** visual baseline remains a machine-checkable release requirement.
- PR #203 / G1: Shared Goal Truth v1, authenticated read-only list/detail routes.
- PR #204 / G2: responsive Control Center consumes Shared Goal Truth; desktop, 390×844, keyboard/focus and reduced-motion acceptance green.
- PR #205 / G3: extension consumes the same Shared Goal Truth semantics.

### Authentic agent boundary

**Authentic Hermes v0.19.0 runtime acceptance was proven** through the bounded Agent Hub boundary, not simulation. Agents may execute authorized work but do not own Goal, Evidence or memory authority.

## G4 — automatic authorized read-only parity ✅

PR #206 froze revision-bound automatic R0 continuation:

```text
trusted Goal research confirmation
→ revision-bound receipt
→ CapabilityRegistry + R0 policy
→ bounded lease
→ Hermes safe search-only discovery
→ searchCandidates
→ Kernel-authorized web.read
→ fetched public source
→ Case + Evidence
→ Opportunity/Find
→ Shared Goal Truth
→ restart-safe continuation
```

Key frozen properties:

- active Goal alone is not authority;
- trusted interactive receipt required;
- Hermes automatic discovery restricted to safe search-only runtime;
- incompatible runtime fails closed;
- search candidates are deterministic and are not Evidence;
- Kernel independently re-fetches public candidates before Evidence;
- authority is checked before network I/O and again before persistence;
- restart recovery is lease-safe and idempotent;
- side effects and durable-memory admission remain separate gates.

`internal.53` and `.54` are frozen failures; `internal.55` is the frozen G4 implementation candidate.

## UAT truthfulness hardening — internal.56 ✅

PR #207 merged at `01a5241ba7de93afe084d42a72e74a59b7fb1128`. Shared Goal Truth preserves automatic policy blocks so the UI cannot fabricate queued progress when execution is safely denied.

## G5.1 — local-first product value scorecard ✅

PR #208 merged at `4f9cfc5fc113366d35532fecfd0403c09f29a471`; `internal.57` is frozen green.

Kernel-local metrics now include, when a trustworthy denominator exists:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Mission completion/failure rate;
- Finds per completed Goal;
- useful/saved and dismissed/not-interested Find shares.

Metrics without a trustworthy local cohort/ledger return `not_measurable` instead of fabricated zero. `profile.productScorecard` is exposed through authenticated read-only `GET /api/preferences`; there is no central telemetry or new authority.

## G5.2 — responsive dashboard scorecard ✅

PR #209 merged at `97f47669d8d0ef16a3127db63a503ce33a9cdaad`; `internal.59` is frozen green after complete pre/post-merge CI, Chromium and packaged Windows 2022/2025 qualification.

The active `EfestoProductShell` consumes the Kernel-owned scorecard without recalculating KPI truth in React. `sourceOfTruth: local_kernel`, local-only privacy and `not_measurable → value:null` are fail-closed dashboard contracts. `internal.58` remains a frozen acceptance-fixture failure and must never be reused.

## G5.3 — authentic public-web journey acceptance ✅ harness / 🟡 live proof

PR #210 merged at `b12f106155d1f3f2e0f771cf77cd04a7cb478bc4`; `internal.60` is frozen after the complete deterministic package matrix and 4/4 post-merge workflows passed.

The existing explicit `pnpm hermes:acceptance:live` path now requires:

- L1 authentic Hermes reaches completed terminal state;
- L2 attempts remain bounded;
- L3 bounded `searchCandidates` exist;
- L4 Kernel `web.read` creates verified Evidence;
- L5 at least one promoted Find matches the tested Goal;
- L6 Find → Case/Evidence → Mission/candidate provenance proves `kernel-web-read-v1` + `web-read:` receipt + fetched content hash;
- L7 Shared Goal Truth converges on the same forged Mission.

Default CI remains deterministic/offline. **The harness is green; authentic Internet/Hermes L1→L7 is not claimed as live-proven until the explicit live command is run in a suitable environment.**

## G5.4 — Kernel-owned one-line Goal intent ✅ implementation / internal.61 frozen failure

Candidate `internal.61` preserved the simple Home experience while enriching discovery intent in the Kernel before persistence.

- The active Home continues to submit only the natural Goal title, lightweight client keywords and priority; no category/price/location form is introduced.
- Explicit supported categories always win; inference runs only when categories are absent.
- Inference is bounded to the existing discovery categories and cannot create execution capabilities.
- Numeric constraints from the canonical title are preserved as keywords within the existing 12-keyword limit.
- Drill UAT intent should persist `offer` + `tool` and `18` + `25`.
- Freelance UAT intent should persist `job` + `client` and `20` + `30`; hourly currency alone must not infer shopping `offer`.
- Unsupported explicit categories still fail closed; generic text with no discovery signal remains invalid.
- Goal validation itself creates no Mission, research authorization, network request or side-effect authority.

`internal.61` is frozen as a failed release qualification. The product behavior passed, but the release matrix exposed a UID-0-specific persistence test and an outdated boundary-only Hermes acceptance harness, so that candidate must never be reused or relabeled.

## Internal.62 — release qualification repair ✅

`internal.62` keeps the G5.4 product behavior unchanged and repairs only the qualification boundaries:

- durable authority persistence failure is tested through a typed filesystem boundary, so the atomic cleanup invariant is deterministic on Windows, ordinary POSIX users and UID 0;
- boundary-only Hermes acceptance uses an explicit trusted loopback UI origin and an isolated read-only-ready runtime contract without requiring an authentic Hermes install;
- live acceptance still requires authentic Hermes and public Internet;
- an exact completed-result retry no longer re-runs Obsidian projection or overwrites the persisted terminal summary/receipt;
- the boundary harness proves authorization, SSRF rejection, forged-lease rejection, bounded batches, Kernel-owned terminal state, deduplication and exact-retry idempotency in 14/14 checks.

PR #212 merged at `80e93b7a5cc6fbec80dc1435b220f88be9dcc477`. The exact published candidate passed local Linux qualification plus all four GitHub workflows: CI/Chromium, internal package, Windows Launcher and Windows First Run, including packaged fresh-install/repair on Windows 2022 and Windows 2025. A production-mode local UAT also verified Kernel/dashboard startup, the two natural one-line Goals, explicit confirmation, truthful `waiting_for_agent` state and desktop/mobile rendering without fabricating Evidence or Finds.

## G5.5 — private local activation and repeat-usage cohort / internal.63

`internal.63` advances the product-value phase without installing anything on the founder's PC:

- first Kernel start initializes one private `local_installation` cohort in the existing local knowledge store;
- the record contains only schema, unit and start timestamp—no global user, account, device or fingerprint identifier;
- first trusted Goal authorization makes installation activation measurable as `1/1` instead of an inferred UI event;
- a second distinct authorized Goal makes local repeat usage measurable as `1/1`; before activation, repeat usage remains `not_measurable`;
- missing or malformed cohort metadata fails measurement closed;
- the dashboard surfaces Repeat Goal Usage as a primary Kernel-owned KPI and local activation as supporting context;
- no central telemetry, outbound route, network authority or new execution capability is introduced.

PR #213 merged at `3d4dbbf18573468bc7656a353f92714b94045dc1`. Its exact implementation SHA passed CI/Chromium, internal package, Windows Launcher and Windows First Run workflows before merge, including the packaged Windows qualification matrix. Aggregate multi-user rates remain unavailable until a separate opt-in privacy design exists.

## G5.6 — remote authentic Hermes public-web proof / internal.64

`internal.64` makes the existing live L1→L7 acceptance runnable on an isolated GitHub-hosted machine without installing anything on the founder's PC:

- fixes the Hermes v0.20 compatibility boundary: `--safe-mode` disabled the bundled backend plugins that provide web search, so the adapter now uses `--ignore-user-config --ignore-rules --toolsets search -z`;
- gives each invocation a fresh `HERMES_HOME` and working directory, removes inherited project-plugin enablement, refuses private-URL search support and retains only public search candidates;
- keeps Kernel-owned `web.read`, Evidence, classification, provenance and final Goal truth unchanged;
- adds a manual-only, least-privilege workflow pinned to Hermes commit `ee4bb75b532e932a1055d9a710802a7435163b6a` and immutable Action commits;
- initially required the repository secret `HEPHAESTUS_LIVE_OPENROUTER_API_KEY` and uploaded only the locally redacted acceptance report;
- strengthens report redaction for provider/API/Authorization-shaped credentials.

PR #214 merged at `6e2aca2c6b06babb400d4c7ed35bb175145f6863`. Its exact candidate SHA passed CI/Chromium, internal package, Windows Launcher and Windows First Run, including packaged Windows 2022/2025 installation and repair. The provider-secret prerequisite remained an external blocker, so no authentic Internet L1→L7 success is claimed from `internal.64`.

## Internal.65 — credential-free remote live-proof repair

`internal.65` removes the founder-owned provider-secret prerequisite without changing product authority or default deterministic CI:

- runs inference only inside the disposable GitHub-hosted runner through Hermes's `custom` provider and `http://127.0.0.1:11434/v1`;
- checksum-verifies the pinned Ollama Linux archive before extraction under `/tmp` and never installs a system service;
- pulls the reviewed `qwen3:4b` tool-capable model, verifies its published model identity before Hermes can use it and binds the server to loopback;
- preserves the pinned Hermes runtime, isolated home/cwd, search-only toolset, Kernel-owned `web.read`, sanitized report and exact L1→L7 acceptance criteria;
- keeps default CI deterministic/offline while automatically qualifying same-repository pull requests and `main` only when the live-acceptance boundary changes, skips forks and retains manual reruns;
- requires no provider secret, founder-PC download or persistent remote installation.

Local qualification on 2026-08-11 is green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1056 tests, production build, `verify:first-run`, offline Hermes boundary acceptance `14/14`, extension packaging and workflow YAML/contract validation.

The candidate is not live-proven merely because the workflow exists. It must pass the complete local/GitHub release matrix and then the live workflow must produce one sanitized report with every L1→L7 check green on the exact candidate SHA.

## Canonical CI/release gate

Every affected candidate must pass on one unchanged SHA:

1. frozen lockfile install;
2. architecture boundary guard;
3. strict `pnpm audit --prod`;
4. TypeScript typecheck;
5. full Vitest suite;
6. production build;
7. `pnpm verify:first-run`;
8. Chromium/Playwright acceptance;
9. Windows launcher smoke and first-run reproduction;
10. exact internal-package generation and SHA binding;
11. exact packaged fresh-install + paired-repair qualification on Windows 2022 and Windows 2025.

Candidate versions are immutable after use. `.41`, `.43`, `.53`, `.54`, `.58` and `.61` remain frozen failures and must never be reused.

## Distribution and public launch

- Windows entrypoint remains `Install Efesto.cmd`.
- `INTERNAL_RELEASE.json` is the single candidate identity source.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be fully green while public launch remains blocked pending manual UAT on the exact candidate.

## What remains

1. Qualify immutable `internal.65` across the complete local and GitHub release matrix, then merge only if the exact SHA is green.
2. Require the automatically triggered `Hermes live public-web acceptance` run on the merged SHA to produce a real green L1→L7 report; do not substitute deterministic CI or workflow presence for proof.
3. Run UAT-1→UAT-6 on the same exact green packaged candidate using the natural one-line Goals and verify Goal → Evidence-backed Find with zero unauthorized side effects.
4. Use the Kernel-owned local-installation scorecard to establish the first real activation, repeat usage and useful-Find baselines before growth/retention/willingness-to-pay claims.
5. Treat notification delivery, aggregate sharing, scheduling expansion, cross-device authority and irreversible actions as separate security/privacy slices.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, Memory Safety v1, Evidence provenance, exact replay and approval gates. G0-G4 are frozen. G5.1 measures local value, G5.2 surfaces the same Kernel scorecard, G5.3 defines explicit live provenance acceptance, G5.4 keeps the Home one-line while the Kernel enriches bounded Goal intent, G5.5 measures activation/repeat usage only for one private local installation, and G5.6/internal.65 runs the authentic Hermes public-web proof remotely with checksum-verified loopback inference and no founder-owned provider credential or PC installation. Search snippets are never Evidence. Never introduce central telemetry, global user/device identity, auto-promote R1/R2/R3 side effects, or imply phone→PC authority. Workflow presence is not live proof; require the exact green L1→L7 report. Finish/verify the exact active candidate before starting a new slice.
```

## Update rule

Replace stale facts here when the verified baseline, blocker, next priority or recovery procedure changes. Do not turn this file into an append-only diary.
