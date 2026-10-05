# Efesto handoff (state as of 2026-10-04 ~16:40 Europe/Paris)

This doc lets another engineer or agent continue from the last step. It lives on `feat/forge-live-view` (PR #244).

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
