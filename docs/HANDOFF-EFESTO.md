# Efesto handoff

**Read §0 first.** It is the current state, as of 2026-10-13 ~17:15 Europe/Paris, on `main`. §1–§8 are the 2026-10-04 snapshot, kept for history. Their PRs, branches, paths and SHAs are outdated unless §0 or §9 repeats them.

## 0. Current state (2026-10-13)

**`main`**
- Merged today, all squash-merged with Lewis's explicit OK:
  - #267 `caddbe2`: the adapter funnel no longer labels candidates as Hallazgos. Only Kernel SUPPORT is a Find.
  - #268 `d071f32`: Hermes selection fix: structured local-model selection (see §9), keeps Goal acronyms, fails fast, readable failure copy.
  - #270 `68595cc`, Phase 1:
    - Planned searches run in parallel.
    - Keyless Wikipedia fallback when ddgs errors or returns 0 hits. Each search records `source` `ddgs | wikipedia`. Off with `HEPHAESTUS_SEARCH_FALLBACK=off`.
    - Ollama selection by number (integer enum), `keep_alive` 30m.
    - The worker polls every 3 s.
    - Adapter one-shot about 8–12 s, down from 17–27 s.
    - Settled-state and Hermes readiness consistency.
  - #273 `1604f84`, Phase 3: Kimi-style premium chrome:
    - Wordmark-only home with the large Goal composer, tray and page chips.
    - Plain sidebar drawer.
    - Decorative home spider wallpaper `apps/dashboard/components/home/home-wallpaper-engine.ts`:
      - It weaves orb webs, and a fly comes rarely.
      - It is `aria-hidden`, ignores the pointer and pauses when the tab is hidden. Reduced motion draws one still frame.
      - It carries no data.
    - The forge/anvil/spider scene and its effects are untouched. `apps/dashboard/lib/premium-chrome-css.test.ts` enforces that the chrome CSS never targets the forge scene.
  - #274 `eb7e381`: extension `#mission-progress` shows a Kernel read without SUPPORT as such, not as "Verification error".
- **Open drafts, NOT merged:**
  - #271 `feat/phase2-windows-one-click`:
    - Windows one-click install: `Instalar Efesto.cmd` / `Iniciar Efesto.cmd` / `Detener Efesto.cmd`.
    - Not yet tested on a real PC.
    - The old `Install Efesto.cmd` (on main) coexists with it.
  - #272 `fix/living-forge-read-without-support`: the Living Forge names a read without SUPPORT.
  - #266: another writer's PR. Don't touch it.

**Roadmap to 100%**
1. Phase 1, search/selection speed and robustness: **done** (#268, #270).
2. Phase 2, Windows installer: #271 (§10), waiting for a real-PC test.
3. Phase 3, polish: **done** (#273, #274).
4. Phase 4: full test on Lewis's Windows PC, with video.
5. Phase 5: launch only with Lewis's approval. `publicLaunchApproved` stays **false**.

**Rules (always)**
- Never fabricate data.
- The only path to a Find is Goal → Evidence → Kernel SUPPORT → Find.
- Never merge to `main` without Lewis's explicit OK. PRs stay drafts. Never force-push.
- Show a mockup or video before any visual change.
- Reply to Lewis in Spanish.

**Box/dev notes**
- **pnpm:** use the repo's pnpm 11.11.0 (`packageManager`): `npx -y pnpm@11.11.0 install --frozen-lockfile`. The box's global pnpm is 9.15.9 and fails with `ERR_PNPM_BROKEN_LOCKFILE`.
- **Node:** Node 22 (`/home/box/.local/node22/bin`).
- **Box DNS:** the sinkhole (198.18.0.0/15, §9) blocks page reads on the box. The Kernel correctly refuses those reads as a private network. Don't weaken the guard.
- **Flaky checks:**
  - The "Hermes live public-web acceptance" workflow (`.github/workflows/hermes-live-public-web-acceptance.yml`) has been flaky. Re-run it once before treating it as red.
  - `scripts/hermes-boundary-acceptance.e2e.test.mjs` fails in a fresh `git worktree` (known gap, §7 #11).
- **Live box (2026-10-13):**
  - Kernel :4310 runs `apps/local-kernel/server.mjs` from `/workspace/phase1`. The token file is `/tmp/forge-kernel-token`; never print it.
  - Dashboard :3311 runs `next start` from the `/workspace/main-eb7e381` worktree.
  - Ollama runs from `/workspace/runtime`. The Hermes worker is `/workspace/runtime/efesto-live/run-hermes-worker.sh` → `queue-worker.mjs`.
  - `next build` rewrites `apps/dashboard/next-env.d.ts`. Run `git checkout --` on it before committing.

## 1. North star

Efesto is a local-first "intelligence forge". Every Find goes through the same pipeline:

**Goal → web search (Hermes) → candidates → Kernel `web.read` → Evidence → Kernel SUPPORT → Find.**

- **Never fabricate.** A Find exists only when the Kernel read the page and SUPPORT passed (`packages/kernel/src/evidence/support.ts`).
  - Agent text is never Evidence.
  - Anything decorative in the UI is labelled and never counted.
- **Local-first.** The Kernel, the agent and the data run on the user's machine.
- **`publicLaunchApproved` stays `false`.** This is not a public launch.

## 2. Lewis's standing rules (owner)

**Language and design**
- Speak Spanish to Lewis. The UI copy is Spanish.
- Show a mockup or video before any visual change, and keep it off live until he approves it.
- Keep the v3 design and only polish it. It must feel premium on both mobile (390) and desktop (1440).

**Git and PRs**
- Never merge and never touch `main` unless Lewis explicitly asks. PRs stay drafts.
- Never force-push.
- Use pnpm only.

**Code**
- Never weaken `packages/kernel/src/evidence/support.ts`. Tightening it with tests is OK.
- **Off-limits:** Memory admit UI, i18n, PWA, chat, Intelligence Brief, `uat-efesto.mjs`.

**Running things**
- Mission runs happen only through Lewis's dashboard confirmation. Never fake confirmations.
- No builds, tests or browsers while Hermes/llama is generating. Pause the worker (§5).
- Lewis wants a video of every live run or visual change, as H.264 mp4 files in `/workspace/ref/forge-v3-polish/`.

**Secrets**
- Never print or commit the Kernel token. It lives in a private file on the box (§5) and is sent as the `x-hephaestus-token` header from scripts only.

## 3. Branches and PRs (`Blackleets/internet-brain-os`)

`main` = `f225af0`. Vercel production builds from `main`. Vercel has no Kernel, so Vercel previews show the dashboard "Kernel sin conexión" (offline). That is expected.

| PR | Branch → base | Head | Contents | CI |
|---|---|---|---|---|
| #241 (ready) | `fix/extension-kernel-supported-find-notify` → main | `532bf93` | Extension delivers Kernel SUPPORT Find notifications | green |
| #244 (draft) | `feat/forge-live-view` → #241's branch | `52c2b29` + this doc | Forge live view v3 (details below) | **`validate` + `package-internal-windows` fail**: `scripts/release-readiness.mjs` still requires `apps/dashboard/public/efesto-smith.svg`, which brand commit `84dc99d` removed. Fix: update the readiness check to the new mark, or restore the file (ask Lewis). |
| #245 (draft) | `feat/mission-search-telemetry` → main | `85b1bb7` | Kernel `searchTelemetry` (display-only): queries, counts, findings funnel, per-search `results` (url + title, ≤10 per search / ≤30 total, sanitized) | green |
| #246 (draft) | `feat/hermes-multi-query` → #245's branch | `3361bac` | Hermes adapter: plans 2–3 queries and runs them itself (ddgs), funnel, Buscar más, bounded selection call (`HERMES_MAX_TOKENS`), per-search `results` | green (l1-l7 is flaky elsewhere) |
| #242 (draft) | `eval/jev-ranking-bench` | `1f765dc` | Offline ranking bench, no product integration | — |

**What #244 contains**
- Forge renderer: spider, anvil, molten threads, gold.
- forge.log beside the stage; decorative probes (`7f57f88`).
- Settling a verification without SUPPORT as `failed` (`b432fbb`, Kernel).
- Agent connector (`ad13654`); legibility polish (`4086cb8`); Kernel pill fix (`4afeaf6`).
- Result webs + idle spider (`39d653f`, **approved by Lewis 2026-10-04**).
- Finds id chips, Spanish next steps, read-failure copy (`52c2b29`).
- Goal revision "Editar Goal" (`37e86ab`). **Lewis has not reviewed it; keep it OFF live.**

**Deploy-order dependency:** #245 (Kernel accepts `results`) must be running before #246 (adapter writes `results`). Otherwise the Kernel rejects the record and drops the whole telemetry.

**Recommended merge order, only when Lewis asks:**
1. #241
2. #245
3. #246 (rebased on main)
4. #244 (rebased; first fix the readiness check)

## 4. Live box (local-only branch `live/forge-telemetry`)

The stack runs from `/workspace/ibos-forge-live`, branch `live/forge-telemetry`. That branch is **not pushed**. It is `8a2f7f6`, a merge of `forge-v2-build` (= #244 at the time) into the telemetry work, plus cherry-picks of the PR commits Lewis approved.

At 16:45 the box was in this state. The live apply was stopped there by a scope cut.
- **Source:** `live/forge-telemetry` is at `5f4825c`. That is the earlier cherry-picks (`0ed1290`, `4086cb8`, `ad13654`, `379b5fe`, `b432fbb`, `7f57f88`, `4afeaf6`, `52c2b29`) plus #245 `85b1bb7`, #246 `3361bac` and `39d653f`.
- **Kernel :4310:** restarted on that source, so #245 telemetry `results` is live.
- **Adapter:** #246 is live for the next mission the worker spawns.
- **Dashboard :3311:** still the earlier build (`52c2b29` level). To finish the apply, run `scripts/live-box/restart3311.sh` under `with-pause.sh`. That puts `39d653f` (idle spider + result webs, approved by Lewis) live.

**Goal revision `37e86ab` is NOT on the live branch.**

**To reproduce the live stack from GitHub alone:**
- `feat/forge-live-view` (#244) already contains the spider, the result webs, the idle spider, the polish and goal revision. It is based on #241.
- `feat/hermes-multi-query` (#246) contains #245.
- Steps:
  1. `git checkout -b live origin/feat/hermes-multi-query`
  2. `git merge origin/feat/forge-live-view`
  3. `git revert 37e86ab` to keep goal revision off until Lewis approves it.
  4. On conflicts, keep both sides' features.
- Then follow §5.

## 5. Running the live stack (box defaults)

**Toolchain:** Node 22 (`/tmp/node-v22.23.3-linux-x64/bin`), pnpm. The scripts are in `scripts/live-box/`; the box copies live in `/tmp`.

**Kernel :4310**
- Script: `scripts/live-box/start-forge-kernel.sh`. Data in `/tmp/forge-kernel-data`.
- Env names: `HEPHAESTUS_DATA_DIR`, `HEPHAESTUS_PORT`, `HEPHAESTUS_API_TOKEN`, `HEPHAESTUS_HERMES_READY`, `HEPHAESTUS_HERMES_READ_ONLY_READY`, `HEPHAESTUS_OBSIDIAN_DIR`.
- The token is a random string in a private file on the box (`/tmp/forge-kernel-token`, mode 600). Never print it.
- Back up the data before every restart: `tar czf /workspace/ref/kernel-backups/forge-kernel-data-<ts>.tgz -C /tmp forge-kernel-data`.

**Dashboard :3311 (live)**
- `scripts/live-box/restart3311.sh` does `pnpm dashboard:build` then `next start` (pid in `/tmp/forge-dashboard.pid`).
- In the browser: Conectar Kernel → `http://127.0.0.1:4310` + token.

**Preview :3312**
- `scripts/live-box/restart3312.sh` builds `/workspace/forge-v2-build` (= #244). Use it for videos before anything goes live.
- `next dev` (e2e) and `next start` share one worktree's `.next`, so rebuild after running e2e. Run `git checkout -- apps/dashboard/next-env.d.ts` after builds and e2e.

**Hermes queue worker**
- Supervisor: `scripts/live-box/run-hermes-worker.sh` (restart loop, pid `/tmp/hermes-worker.pid`). It runs `queue-worker.mjs`.
- The worker claims only queued Missions whose authorization is `approved` by an `interactive_user`, FIFO, one at a time, up to 3 attempts, then Kernel verify.
- It warms Ollama first and pings `/api/agents/hermes/ping` about once a minute, so the connector shows "Hermes conectado".
- Environment: `hermes-worker-env.example` → `/tmp/.hermes-worker-env`.
  - Ollama at `127.0.0.1:11434`, model `qwen3.5:2b`.
  - Hermes CLI in a venv: `/tmp/efesto-live/hermes-agent/.venv/bin/hermes`.
  - Search through DuckDuckGo (`ddgs`), run by the adapter.
- Logs: `/tmp/hermes-worker.log`, plus a per-run `/tmp/hermes-worker-runs.jsonl`.

**Pausing the worker**
- Pause file: `/tmp/hermes-worker.pause`. Always use `scripts/live-box/with-pause.sh <cmd>`; its trap removes the file even on failure.
- **The worker must end unpaused and idle**, because Lewis expects confirmed Goals to process on their own.

**Shell gotchas**
- Never `pkill -f` a pattern that also appears in your own command line. Kill by pid from the pid files.
- Use `nohup`/`setsid` for anything long.

**Tools** (`scripts/live-box/tools/`)
- `queue-report.mjs`: per-Goal funnel report.
- `rec-webs-idle.mjs`: preview video recorder.
- `perf-webs-idle.mjs`: frame timing without video.
- `goal-shot.mjs`, `finds-shot.mjs`, `connector-shots.mjs`: screenshots.
- `rerun-searches.mjs`: re-runs a mission's planned queries read-only.
- Encode videos with ffmpeg H.264 `yuv420p` `crf 20` `+faststart`.

## 6. Real results so far (Kernel data, 2026-10-04)

Report: `/workspace/ref/forge-v3-polish/queue-report.json`.

| Goal | Result | Detail |
|---|---|---|
| "Encuentra las mejores herramientas para mi negocio" | forged, 6 Finds | 10 candidates → 7 read → 6 SUPPORT: Brevo, IEBS, visual bloom, ACC, Wix, Fabi Paolini. Attempt 1 failed (invalid JSON); attempt 2 took 77 s. |
| "busca empleo de uber eats" | forged, 1 Find | Trabajalia. es.trabajo.org passed SUPPORT but got no Find because of a category mismatch. |
| "busca empleo en mercadona" | `failed` / `web_read_failed` | 4 candidates, none readable: linkedin/indeed "red privada" (box DNS), mercadona 403, infojobs anti-bot. The UI explains why and offers Buscar más. |
| "busca agua en africa" | forged, 1 Find | Wikipedia "Escasez de agua en África". |
| Rider runs | not forged | Run 6 "empleo de rider o delivery en España" settled `failed/verified_without_support`. "quiero budcar empleo de ryder…" settled `failed/web_read_failed`. Both were stuck in `running/verifying` until fix `b432fbb`. |

## 7. Known gaps (prioritized)

1. **CI on #244:** release-readiness still expects `efesto-smith.svg` (§3).
2. **qwen3.5:2b sometimes emits "thinking" text**, which makes attempt 1 invalid JSON. Attempts 2–3 usually recover. Fix: stricter JSON mode, or a larger or free model.
3. **Box DNS** resolves linkedin.com and indeed.com to private addresses, so the Kernel refuses them as "red privada". Many job portals also block bots (403 or a challenge page).
4. **Funnel `other` drops cannot be attributed.** The adapter should record a reason.
5. **es.trabajo.org:** SUPPORT passed, but the classifier category did not match the Goal's job scope, so no Find was created. Review classifier vs SUPPORT.
6. **The Kernel records any worker as "hermes".** Add a worker or agent identity.
7. **`missionFailureRate` now counts no-SUPPORT settlements.** This is honest, but changes the metric's meaning.
8. **Objetivos CLS ≈ 0.06–0.08.**
9. **The agent-connector e2e opens the sheet with a scripted click** on the dev server.
10. **Flaky `l1-l7` CI test**, and a **failing hourly routine** (investigate; not caused by these PRs).
11. **`scripts/hermes-boundary-acceptance.e2e.test.mjs` fails only in a fresh `git worktree`** with symlinked `node_modules`. It passes in the real trees. This is environmental.
12. **Goal revision `37e86ab`** is waiting for Lewis's review.

## 8. Next steps

1. Finish the live apply by rebuilding 3311 (§4). Record live videos at 1440 and 390 for Lewis. The worker must be left unpaused and idle.
2. Fix the release-readiness check on #244. Ask Lewis whether to restore the smith asset or point the check at the new mark.
3. Show Lewis goal revision `37e86ab` (video at 390 and 1440) and get an OK before it goes live.
4. Model robustness: JSON-only output for qwen, and more free or local model options.
5. Search quality: attribute every drop reason, avoid sources that are bot-blocked, add more sources beyond ddgs.
6. When Lewis asks: merge in the §3 order and verify Vercel production.

## 9. Update 2026-10-13

- **Local-model selection (#268, on `main`):** set `HEPHAESTUS_SELECTION_BACKEND=ollama-structured` in the worker env to have the adapter pick candidates through Ollama `/api/chat`. It runs with `think:false` and `num_ctx 8192`, and its `format` is a JSON schema whose `url` is an enum of the listed search hits, so the model cannot invent a URL. The default stays `hermes`. Attempts now default to 4 min (`HEPHAESTUS_HERMES_ONESHOT_TIMEOUT_MS`); the live-box example uses 240000 / 300000. Uppercase Goal acronyms (IA, AI) are kept in queries, and ad redirects are dropped. With qwen3.5:2b, the first attempt yields 5–6 real candidates in about 50–150 s.
- **Box DNS limitation:** the box now resolves every public host to `198.18.0.1` (egress tunnel, benchmark range 198.18.0.0/15). The Kernel correctly refuses it as a private network, so on the box every candidate ends "Sin lectura · red privada" and no Finds are forged. Do not weaken the guard in the repo. On 2026-10-13 Lewis approved a one-off, uncommitted, env-gated box exception: it forged 7 Finds and was removed right after. Real Finds need a machine with real DNS, such as Lewis's PC.
- **Box toolchain:** see §0 "Box/dev notes" for the current, verified paths. Note: `setsid nohup … & echo $!` records the wrapper pid, so read the real pids from `ss -ltnp`.

## 10. Windows one-click install (Phase 2, PR #271 draft — not on `main` until merged)

For Lewis's PC (Windows, `C:\Users\Usuario`). Everything a user touches is in Spanish.

- **`Instalar Efesto.cmd`** runs `scripts/windows/install-efesto-windows.ps1`. It is safe to re-run.
  1. Checks Git, Node 22+, Python and Ollama, and installs any that are missing with winget. Hermes needs **Python 3.14 exactly**: `ae3f9f9c` declares `requires-python >=3.11,<3.15`, but every core dependency is gated `; python_version >= '3.14'`, so on 3.13 the venv lacks `ruamel.yaml`/`python-dotenv` and `hermes.exe` crashes (seen on Lewis's PC). The installer finds 3.14 via `py -3.14`, PATH or `Python314` folders, otherwise runs `winget install Python.Python.3.14 --scope user`; other Pythons are left alone. Hermes: the user's `%LOCALAPPDATA%\hermes\hermes-agent` is used only if it is at `ae3f9f9c` and `hermes chat --help` passes; otherwise Efesto installs its own pinned copy in `%LOCALAPPDATA%\Efesto\hermes-agent` (`pip install -e .[ddgs]` in a 3.14 venv; a venv on another Python or with a failing `chat --help` is recreated) and smoke-checks the safe-search flags (`--query --quiet --max-turns --toolsets --ignore-rules`), failing with a Spanish message. The chosen exe is exported as `HEPHAESTUS_HERMES_EXECUTABLE`/`EFESTO_HERMES_ROOT` and persisted as `hermesExecutable` (+ port 4310) in `kernel-data\efesto-launcher-config.json`; launcher repair restarts an owned Kernel whose start-time Hermes certification is stale and never touches a foreign one. The `.ps1` files are UTF-8 with BOM so Windows PowerShell 5.1 shows Spanish accents correctly.
  2. Installs Hermes Agent, pinned to `ae3f9f9c`, with `[ddgs]`, into `%LOCALAPPDATA%\hermes\hermes-agent\venv`. That is the path the launcher already detects.
  3. Runs `ollama pull qwen3.5:2b`.
  4. Runs the existing `scripts/install-efesto.ps1` with `HEPHAESTUS_PORT=4310` and the data dir in `%LOCALAPPDATA%\Efesto\kernel-data`.
  5. Runs `pnpm dashboard:build` and writes `%LOCALAPPDATA%\Efesto\hermes-worker.env`, the Windows equivalent of `hermes-worker-env.example`.
  6. Creates the desktop shortcuts **Iniciar Efesto** and **Detener Efesto**, then starts everything.
  - `-DryRun` prints every step and changes nothing.
- **`Iniciar Efesto.cmd`** runs `node scripts/windows/efesto-windows-stack.mjs start`, in this order: config → Ollama and model → Kernel :4310 (through `efesto-launcher.mjs repair`) → dashboard :3311 (`next start`) → Hermes worker.
  - Anything already healthy is reused. The worker is supervised and restarts after 15 s.
  - It then copies the Kernel token to the clipboard with `clip.exe` (the token is never printed) and opens `http://127.0.0.1:3311`, so the user can paste it into Conectar Kernel.
  - If prerequisites are missing, it falls back to the installer.
- **`Detener Efesto.cmd`** stops the worker and the dashboard (pids in `%LOCALAPPDATA%\Efesto\stack-processes.json`) and asks the launcher to shut down the Kernel. Ollama is left running.
- Logs are in `%LOCALAPPDATA%\Efesto\logs\`.
- Worker pause file: `%LOCALAPPDATA%\Efesto\hermes-worker.pause`.
- `queue-worker.mjs` now reads `EFESTO_REPO_ROOT`, `EFESTO_KERNEL_URL`, `EFESTO_KERNEL_TOKEN_FILE`, `EFESTO_WORKER_PAUSE_FILE` and `EFESTO_WORKER_RUNS_FILE`. The box defaults are unchanged.
### 10.1 EfestoSetup.exe — one download, double-click, done (2026-10-14)

Goal from Lewis: install like the ChatGPT/Grok desktop apps. No browser extension in the default flow, no consoles, no pairing codes.

- **Installer:** `installer/windows/efesto.iss` (Inno Setup 6). It is built by `.github/workflows/windows-installer.yml` on `windows-latest` and uploaded as the **`EfestoSetup`** artifact of that workflow run.
  - Per-user install, no admin (`PrivilegesRequired=lowest`). The program goes to `%LOCALAPPDATA%\Efesto\app`; data stays in `%LOCALAPPDATA%\Efesto` (kernel-data, hermes-agent, node, logs).
  - It copies the tracked sources (`git archive`) and runs `scripts/windows/install-efesto-windows.ps1 -SkipShortcuts -NoStart -ProgressFile … -LogFile …` in a hidden window.
  - The wizard shows a Spanish progress page ("Paso N de 9"). The full log goes to `%LOCALAPPDATA%\Efesto\logs\instalacion.log`.
  - If something fails, the user gets a Spanish message with the log path. Re-running the setup is safe.
- **Prerequisites, all per user:**
  - Node 22 is a portable `v22.23.3` zip in `%LOCALAPPDATA%\Efesto\node`, checked against the official SHA-256. The MSI from `OpenJS.NodeJS.LTS` is no longer used.
  - Python 3.14 via `winget --scope user`.
  - Git and Ollama via winget `--scope user`. If no user-scope installer exists, it falls back to the standard winget installer, which may ask for UAC.
  - Hermes pinned to `ae3f9f9c` and `qwen3.5:2b`, as before.
  - Kernel and dashboard as a production build (`next build` / `next start -H 127.0.0.1`).
- **Shortcuts:** "Efesto" on the desktop and in the Start menu, plus "Detener Efesto" and "Desinstalar Efesto" in the Start menu.
  - They run `wscript scripts/windows/efesto-launch.vbs open|stop` (window style 0, so no console). That calls `efesto-windows-stack.mjs open`: it starts Ollama → Kernel → dashboard → worker hidden, then opens `http://127.0.0.1:3311/` (the spider home) with `rundll32 url.dll,FileProtocolHandler`.
  - Errors show a Spanish MsgBox. The log is in `logs\launcher.log`.
- **No extension, no pairing:** the dashboard has a same-origin loopback bridge, `app/efesto-local/{status,kernel/[...path]}` → `lib/server/local-kernel-proxy.ts`.
  - It is enabled only when the stack starts `next start` with `EFESTO_LOCAL_KERNEL_TOKEN_FILE`, so it is off on Vercel.
  - The server reads the token file the Kernel writes and adds `x-hephaestus-token`. The token never reaches the browser, URLs, logs or responses.
  - Requests are refused unless all of these hold: a loopback `Host` (anti DNS-rebinding), `Origin` equal to its own origin, `Sec-Fetch-Site` same-origin, the `x-efesto-local: 1` header (which forces a CORS preflight, so other sites cannot call it), and a path of only `/health|/status|/bootstrap/status|/api/*`. The Kernel URL must be loopback.
  - The browser side (`lib/session/local-kernel.ts`, sentinel `efesto-local-transport-v1`, never stored in sessionStorage) auto-connects on load before trying the optional extension.
  - The Kernel starts with `HEPHAESTUS_PAIRING=0` and `EFESTO_PAIRING_OPTIONAL=1`. Launcher repair then reuses an unpaired Kernel instead of restarting it to show a pairing code.
- **The extension is optional:** `install-efesto.ps1 -SkipExtension -SkipLauncherRepair` is used by the one-click flow. `Iniciar Efesto.cmd` no longer copies the token. `copy-token` stays only for manual or extension pairing.
- **Uninstall:** "Efesto" appears in Apps & features (HKCU). The uninstaller stops Efesto, removes `%LOCALAPPDATA%\Efesto\app` and the shortcuts, and asks (default No) whether to also delete the data in `%LOCALAPPDATA%\Efesto`.
- **Pending and limits:**
  - **No code signing yet**, so SmartScreen shows "Windows protegió su PC" (Más información → Ejecutar de todas formas).
  - CI only smoke-tests a silent `/DRYRUN=1` install and uninstall. The real downloads (winget, Hermes pip, the 2-3 GB model, `pnpm install`/`next build`) have not been exercised on a real PC.
  - The installer needs internet and winget (App Installer). x64 only.
  - `publicLaunchApproved` stays false.

- **Not yet verified on a real Windows PC.** CI (`windows-one-click.yml`) only parses the scripts and runs the dry run and config generation on windows-2022. No winget installs, Hermes pip install, model pull or real start have been exercised.
