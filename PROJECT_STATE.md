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

- fixes the Hermes v0.20 compatibility boundary: `--safe-mode` disabled the bundled backend plugins that provide web search, while scripted `-z` failed to forward the configured turn cap, so the adapter uses the bounded quiet chat query with explicit `--max-turns`, `--ignore-rules` and search-only toolsets;
- gives each invocation a fresh `HERMES_HOME` and working directory, removes inherited project-plugin enablement, refuses private-URL search support and retains only public search candidates;
- keeps Kernel-owned `web.read`, Evidence, classification, provenance and final Goal truth unchanged;
- adds a manual-only, least-privilege workflow pinned to Hermes commit `ee4bb75b532e932a1055d9a710802a7435163b6a` and immutable Action commits;
- initially required the repository secret `HEPHAESTUS_LIVE_OPENROUTER_API_KEY` and uploaded only the locally redacted acceptance report;
- strengthens report redaction for provider/API/Authorization-shaped credentials.

PR #214 merged at `6e2aca2c6b06babb400d4c7ed35bb175145f6863`. Its exact candidate SHA passed CI/Chromium, internal package, Windows Launcher and Windows First Run, including packaged Windows 2022/2025 installation and repair. The provider-secret prerequisite remained an external blocker, so no authentic Internet L1→L7 success is claimed from `internal.64`.

## Internal.65 — credential-free remote live-proof repair / frozen failure

`internal.65` removes the founder-owned provider-secret prerequisite without changing product authority or default deterministic CI:

- runs inference only inside the disposable GitHub-hosted runner through Hermes's `custom` provider and `http://127.0.0.1:11434/v1`;
- checksum-verifies the pinned Ollama Linux archive before extraction under `/tmp` and never installs a system service;
- pulls a reviewed Qwen3 tool-capable model, verifies its published model identity before Hermes can use it and binds the server to loopback;
- preserves the pinned Hermes runtime, isolated home/cwd, search-only toolset, Kernel-owned `web.read`, sanitized report and exact L1→L7 acceptance criteria;
- keeps default CI deterministic/offline while automatically qualifying same-repository pull requests and `main` only when the live-acceptance boundary changes, skips forks and retains manual reruns;
- requires no provider secret, founder-PC download or persistent remote installation.

Local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1056 tests, production build, `verify:first-run`, offline Hermes boundary acceptance `14/14`, extension packaging and workflow YAML/contract validation. PR #215 head `a78a1745063c9dd0f0bcd0949e7050fb6a1f80d9` then passed CI/Chromium, Windows Launcher, Windows First Run and packaged Windows 2022/2025 qualification.

The authentic live run `31468965456` exposed two real control-budget failures. The pinned Hermes `--ignore-user-config` path restored its built-in `agent.max_turns: 500`, so time was the only practical loop bound. The mission worker and acceptance observer then both expired at 15 minutes while the inner Hermes adapter was allowed 20 minutes. The observer captured `running/investigating` as the worker concurrently persisted failure, and GitHub cleanup found the still-running process tree. The sanitized report proved only 7/13 checks and no candidates/Evidence/Find. `internal.65` is therefore frozen as failed and must never be reused or relabeled.

## Internal.66 — live agent deadline and process-lifecycle repair / frozen failure

`internal.66` preserves the exact credential-free runtime and L1→L7 truth criteria while repairing only the failed control plane:

- replaces Hermes's 500-turn isolated default with one exclusively created private ephemeral profile capped at eight turns;
- keeps the fresh home/cwd, ignores rules/memory, disables project plugins and exposes only `search` without loading any user configuration;
- enforces a machine-checked live budget of 25 minutes for the inner Hermes adapter, 26 minutes for the worker, 27 minutes for terminal observation and 60 minutes for the outer job;
- rejects any live configuration that does not satisfy adapter < worker < terminal;
- waits for the adapter process to close before recording timeout or output-limit failure;
- escalates ignored graceful termination to a bounded forced kill, preventing orphaned Hermes processes;
- keeps the search-only toolset, loopback model, Kernel-owned `web.read`, Evidence/provenance gates and sanitized report unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, workflow YAML parsing, 187 test files / 1059 tests, production build, `verify:first-run`, offline Hermes boundary acceptance `14/14` and extension packaging. Regression coverage includes an actual child process that ignores graceful termination and must be gone before the worker returns. PR #215 head `45ea90ff9b9ab6a696e12c1e3e12ee579139d218` then passed the complete CI/Chromium/Windows/package matrix.

Live run `31471100120` proved the control-plane repair: Hermes completed in one bounded attempt, the process closed cleanly, four candidates were persisted, Kernel `web.read` created one verified Evidence item and Goal Truth converged on `forged`. The unchanged report still failed closed at 12/14 because that page was ordinary Evidence: zero Finds were promoted, so L5 and L6 failed. `internal.66` is frozen as failed and must never be reused or relabeled.

## Internal.67 — durable live discovery target repair / frozen failure

`internal.67` preserves every authority, Evidence, classifier and L1→L7 threshold while repairing only the live discovery target and candidate quality:

- replaces the fragile course query with a public open-source developer-tool Goal whose canonical pages normally expose API, documentation, installation and license details in fetched content;
- asks Hermes to prefer canonical directly readable pages and avoid login walls, paywalls, redirectors, search-result pages and JavaScript-only shells;
- requests six to ten relevant findings across diverse hosts when public search supports them, while retaining the hard maximum of twenty;
- does not use search snippets to satisfy classification and does not lower the Opportunity score, Goal category match, Evidence or provenance requirements.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, workflow contracts, 187 test files / 1060 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14`, extension packaging and diff validation. PR #215 head `f15cf2c08ec7cb6f977f10494f85c56a44ca9bcd` passed the complete CI/Chromium/Windows/package matrix.

Live run `31472695411` exposed that the nested deadlines were per attempt while terminal observation was per mission. The first 25-minute adapter attempt timed out, the normal product loop immediately started attempt two, and the 27-minute observer expired while that second child was active. The sanitized report therefore failed 8/14 with `running/investigating`, zero candidates and `attempt=2`. `internal.67` is frozen as failed and must never be reused or relabeled.

## Internal.68 — global live-attempt budget repair / frozen failure

`internal.68` preserves the product's default three-attempt recovery while making the disposable live proof one bounded attempt:

- adds a fail-closed automatic-attempt setting limited to one through three; the product default remains three and the live workflow selects one;
- lets an explicitly recorded queued failure end acceptance observation immediately as a failed outcome instead of waiting while no further live attempt is authorized;
- supports a stricter per-run Hermes cap that can only reduce the default eight turns; live acceptance selects four;
- limits the prompt to at most two public searches and asks for four to eight findings, keeping the hard maximum of twenty;
- retains the same 25/26/27/60-minute process deadlines, Kernel Evidence/classifier authority and unchanged L1→L7 success criteria.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, workflow contracts, 187 test files / 1062 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14`, extension packaging, diff validation and sensitive-data preflight. PR #215 head `fb23097f7111793f152eb54669627a433316166f` passed the complete CI/Chromium/Windows/package matrix.

Live run `31475334542` proved that the global attempt budget is repaired: exactly one attempt ran, no second adapter overlapped it and the queued failure became immediately observable. The unchanged report still failed 8/14 after the 25-minute adapter deadline because the reviewed Qwen3 4B model did not produce a valid result on the GitHub CPU runner within that bound. `internal.68` is frozen as failed and must never be reused or relabeled.

## Internal.69 — bounded live-inference model repair / frozen failure

`internal.69` changes only the disposable inference artifact selected by the remote live workflow:

- replaces Qwen3 4B with the reviewed `qwen3:1.7b` tool-capable Ollama artifact to fit the existing bounded GitHub CPU execution window;
- verifies the published model identity `8f68893c685c` and tool capability before Hermes can start;
- retains one attempt, four turns, two searches and the existing 25/26/27/60-minute deadlines;
- leaves the prompt, Kernel Evidence/classifier authority and all L1→L7 acceptance thresholds unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, workflow contracts, 187 test files / 1062 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `888b5a21024071f550a6a75096395c7129b32cf6` passed Windows Launcher, Windows First Run and internal-package qualification; live inference run `31477795868` downloaded the 1.7B model and verified its identity plus tool capability, then Hermes exited non-zero in 5.9 seconds before producing candidates. Both process layers discarded child stderr, so the sanitized report could prove only 8/14 and not identify the provider failure. `internal.69` is frozen as failed and must never be reused or relabeled.

## Internal.70 — sanitized live-provider diagnostics / frozen failure

`internal.70` retains the exact 1.7B model experiment and changes only bounded failure observability:

- carries non-zero Hermes stderr through the adapter after credential, token and absolute-path redaction;
- applies the same redaction again at the worker boundary and persists the bounded failure reason;
- includes that sanitized reason in L1 report detail while keeping raw provider output out of the artifact;
- leaves every authority boundary, attempt/turn/search/deadline bound and L1→L7 success threshold unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1065 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `58bb99e0377430c53b835632cbf94620b8d2219b` passed the complete CI/Chromium/Windows/package matrix.

Live run `31478344733` then produced the intended actionable, sanitized reason: Qwen3 1.7B truthfully reports a 40,960-token context, below Hermes Agent's 64,000-token minimum. The model must not be misrepresented through a fake context override. The report failed closed at 8/14, so `internal.70` is frozen as failed and must never be reused or relabeled.

## Internal.71 — truthful compact-context model repair / frozen failure

`internal.71` preserves the new diagnostic path and replaces only the incompatible model artifact:

- selects reviewed tool-capable `qwen3.5:2b`, whose published model family supports a 256K context and therefore truthfully satisfies Hermes's 64K minimum;
- verifies the published Ollama model identity `324d162be6ca` and tool capability before Hermes starts;
- retains the bounded 8K runtime context, one attempt, four turns, two searches and 25/26/27/60-minute deadlines;
- leaves the prompt, Kernel Evidence/classifier authority and all L1→L7 thresholds unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1065 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `3f6d56da42bab21cb86fa781930f24ba42904b4f` passed the complete CI/Chromium/Windows/package matrix.

Live run `31478786066` proved the model compatibility repair and completed real inference in 8m39s without timeout, but the adapter rejected the final response as invalid JSON before any candidates could be persisted. The report failed closed at 8/14, so `internal.71` is frozen as failed and must never be reused or relabeled.

## Internal.72 — bounded Qwen output-envelope repair / frozen failure

`internal.72` retains the exact compatible model and changes only model-mode and output-envelope handling:

- selects Qwen's documented `/no_think` soft switch for the bounded discovery-plus-JSON task;
- strips only a known `<think>…</think>` envelope and the existing optional JSON fence before strict parsing;
- keeps rejecting prose, malformed JSON, unsupported fields and more than twenty findings;
- reports only safe output-shape metadata when parsing fails, never raw model content;
- leaves Kernel authority and all attempt/turn/search/deadline and L1→L7 bounds unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1067 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `7c89857b7024ef4da0d05cbc9fac12de6e3bc046` passed the complete CI/Chromium/Windows/package matrix.

Live run `31479818132` completed real inference in 4m29s, but the fenced response still did not parse as strict JSON after the known envelope normalization. The sanitized shape metadata does not expose raw model content, so it does not prove which internal JSON token was invalid. The report failed closed at 8/14 before candidate persistence, so `internal.72` is frozen as failed and must never be reused or relabeled.

## Internal.73 — broader JSON-fence and concise-output repair / frozen failure

`internal.73` retains the exact compatible model and changes only bounded response formatting:

- accepts optional whitespace between the opening markdown fence and its `json` label before strict parsing;
- asks for three to five concise findings with one-line JSON-escaped strings and no trailing commas;
- keeps strict schema and field validation after envelope normalization;
- leaves Kernel authority and all attempt/turn/search/deadline and L1→L7 bounds unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1068 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `38c01e17578adc57c19564bf975a4b3efafc8e7d` passed the complete CI/Chromium/Windows/package matrix.

Live run `31480815149` then performed 11m50s of real inference before Hermes exited with code 2 without a terminal response. No parser error occurred, and the report failed closed at 8/14 before candidate persistence. `internal.73` is frozen as failed and must never be reused or relabeled.

## Internal.74 — one-search terminal-response repair / frozen failure

`internal.74` retains the exact model and security boundary while tightening the agent path:

- requires exactly one public search call followed immediately by final JSON, with no second tool call;
- retains the one-attempt, four-turn and nested deadline bounds;
- requests the Hermes usage file but exposes only completion/failure booleans and bounded API/token counters on a silent non-zero exit;
- keeps the same concise output instructions, strict schema validation, Kernel authority and L1→L7 thresholds.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1069 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `f7b279bd839ed99f8e0b55902ba3070dd228e00a` passed the complete CI/Chromium/Windows/package matrix.

Live run `31482264226` completed the one-search path and returned a fenced response containing `findings`, but strict parsing still rejected its 5,932-character internal JSON syntax. The report failed closed at 8/14 before candidate persistence, so `internal.74` is frozen as failed and must never be reused or relabeled.

## Internal.75 — bounded deterministic JSON repair / frozen failure

`internal.75` retains the successful one-search terminal path and adds only bounded syntax normalization:

- caps requested title/text/summary lengths at 160/300/160 characters;
- escapes literal newline, carriage-return and tab controls only while inside JSON strings;
- removes only trailing commas immediately before `]` or `}`;
- then applies the unchanged strict field whitelist, value bounds, Kernel authority and L1→L7 thresholds.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1070 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `45a4e9791395278603c9c57fff14b532d6e566e8` passed the complete CI/Chromium/Windows/package matrix.

Live run `31483306338` ran for 4m39s and returned a fenced 1,734-character response containing `findings`, but none of the `.75` syntax repairs applied and strict parsing failed closed at 8/14 before candidate persistence. `internal.75` is frozen as failed and must never be reused or relabeled.

## Internal.76 — URL-only fenced-payload repair / frozen failure

`internal.76` reduces the untrusted model boundary while preserving the one-search terminal path:

- requests only three to five public URLs, without model-authored titles, snippets, summaries or dates;
- derives neutral title/text placeholders locally and leaves substantive content exclusively to Kernel `web.read` verification;
- parses only the first fenced JSON payload, ignoring presentation text after its closing fence;
- repairs invalid JSON string escapes, then applies the unchanged strict field whitelist, value bounds, Kernel authority and L1→L7 thresholds.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1074 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `ba25a0f28deffb37d70a29ffdd6c9c587162f13c` passed the complete CI/Chromium/Windows/package matrix.

Live run `31484220482` ran for 15m22s before Hermes exited code 2 without a terminal response; its sanitized usage report showed `completed=false`, `failed=false` and 15 API calls. Inspection of pinned Hermes commit `ee4bb75b532e932a1055d9a710802a7435163b6a` established that `hermes -z` constructs `AIAgent` without forwarding `agent.max_turns`, leaving its internal 90-iteration default in authority despite Efesto's exclusive four-turn profile. The report failed closed at 8/14, so `internal.76` is frozen as failed and must never be reused or relabeled.

## Internal.77 — authoritative CLI turn cap / frozen failure

`internal.77` keeps the URL-only candidate boundary while repairing the actual agent-loop control:

- replaces scripted `-z` with Hermes's supported quiet `chat --query` path;
- passes the reviewed cap through explicit `--max-turns`, which the pinned chat path forwards to `AIAgent.max_iterations`;
- probes `hermes chat --help` and fails readiness closed unless query, quiet, max-turns, ignore-rules and toolset controls are all advertised;
- keeps the exclusive profile, one search, one Efesto attempt, nested deadlines, search-only tools and all Kernel/Evidence authority unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1074 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging. PR #215 head `826e396274dd11bbc167325bf6df86823fc4cacd` passed the complete CI/Chromium/Windows/package matrix.

Live run `31486248829` failed closed in 3.8 seconds when the quiet chat process exited code 1 before inference. Inspection of the pinned chat path confirmed that model selection ignores `HERMES_INFERENCE_MODEL` and provider selection prefers its CLI config before the environment; the exclusive profile intentionally contains no inherited route configuration. `internal.77` is frozen as failed and must never be reused or relabeled.

## Internal.78 — explicit bounded inference route

`internal.78` retains the authoritative chat turn cap and supplies the missing isolated route explicitly:

- reads the already-configured `HERMES_INFERENCE_PROVIDER` and `HERMES_INFERENCE_MODEL` values from the adapter process environment;
- rejects route values over 160 characters or containing control characters;
- passes non-empty values as direct `--provider` and `--model` spawn arguments without a shell;
- keeps the empty private profile, search-only tools, one search, one Efesto attempt, nested deadlines and all Kernel/Evidence authority unchanged.

Complete local qualification on 2026-08-11 was green for architecture, `release:verify`, production dependency audit, typecheck, 187 test files / 1074 tests, production build, `verify:first-run`, exact/altered replay, Replay Lab smoke, offline Hermes boundary acceptance `14/14` and extension packaging.

The exact candidate must pass the complete GitHub matrix and produce an authentic sanitized `14/14` report before merge.

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

Candidate versions are immutable after use. `.41`, `.43`, `.53`, `.54`, `.58`, `.61`, `.65`, `.66`, `.67`, `.68`, `.69`, `.70`, `.71`, `.72`, `.73`, `.74`, `.75`, `.76` and `.77` remain frozen failures and must never be reused.

## Distribution and public launch

- Windows entrypoint remains `Install Efesto.cmd`.
- `INTERNAL_RELEASE.json` is the single candidate identity source.
- `publicLaunchApproved` remains `false`.
- The **public release light is separate** from implementation readiness: automated qualification may be fully green while public launch remains blocked pending manual UAT on the exact candidate.

## What remains

1. Qualify immutable `internal.78` across the complete local and GitHub release matrix, then merge only if the exact SHA and authentic sanitized L1→L7 report are green.
2. Require the automatically triggered `Hermes live public-web acceptance` run on the merged SHA to produce a real green L1→L7 report; do not substitute deterministic CI or workflow presence for proof.
3. Run UAT-1→UAT-6 on the same exact green packaged candidate using the natural one-line Goals and verify Goal → Evidence-backed Find with zero unauthorized side effects.
4. Use the Kernel-owned local-installation scorecard to establish the first real activation, repeat usage and useful-Find baselines before growth/retention/willingness-to-pay claims.
5. Treat notification delivery, aggregate sharing, scheduling expansion, cross-device authority and irreversible actions as separate security/privacy slices.

## Recovery prompt

```text
Continue HEPHAESTUS using Blackleets/internet-brain-os only. Read PROJECT_STATE.md, AGENTS.md, ARCHITECTURE.md and live GitHub first. Preserve Kernel authority, Memory Safety v1, Evidence provenance, exact replay and approval gates. G0-G4 are frozen. G5.1 measures local value, G5.2 surfaces the same Kernel scorecard, G5.3 defines explicit live provenance acceptance, G5.4 keeps the Home one-line while the Kernel enriches bounded Goal intent, G5.5 measures activation/repeat usage only for one private local installation, and G5.6/internal.78 runs the authentic Hermes public-web proof remotely with checksum-verified loopback Qwen3.5 2B inference, truthful 256K model context, bounded 8K runtime context, Qwen non-thinking mode, one live attempt capped authoritatively at four turns through quiet `chat --query --max-turns`, explicit bounded provider/model routing and exactly one search, URL-only JSON candidates, first-fenced-payload extraction, bounded deterministic syntax repair, neutral locally derived candidate labels, canonical directly readable discovery targets and no founder-owned provider credential or PC installation. Search snippets are never Evidence. Never introduce central telemetry, global user/device identity, auto-promote R1/R2/R3 side effects, or imply phone→PC authority. Workflow presence is not live proof; require the exact green L1→L7 report. Finish/verify the exact active candidate before starting a new slice.
```

## Update rule

Replace stale facts here when the verified baseline, blocker, next priority or recovery procedure changes. Do not turn this file into an append-only diary.
