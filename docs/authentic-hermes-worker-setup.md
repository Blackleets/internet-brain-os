# Authentic Hermes Worker Setup

This guide prepares Efesto's Agent Hub worker to invoke the user's authentic Hermes runtime without granting Hermes Kernel authority.

## Security boundary

The worker sends one bounded `efesto.hermes-mission.v1` JSON object to the bundled adapter over stdin. The adapter invokes the authentic Hermes CLI in scripted one-shot mode and returns only:

```json
{
  "findings": [
    {
      "url": "https://public.example/item",
      "title": "Public finding title",
      "text": "Bounded public-source text",
      "summary": "Optional bounded summary",
      "discoveredAt": "2026-07-22T10:00:00.000Z"
    }
  ]
}
```

The Kernel still owns URL validation, Evidence creation, deduplication, Goal-scope enforcement, Opportunity classification, persistence, retry state, and final mission state.

## Bundled adapter

`scripts/hermes-efesto-adapter.mjs`:

1. reads exactly one mission JSON object from stdin;
2. validates `efesto.hermes-mission.v1`;
3. builds a bounded public-research prompt;
4. creates one exclusive private config in the ephemeral home with `agent.max_turns: 8`, then invokes the authentic CLI from that empty home/working directory with `--ignore-rules --toolsets search -z`;
5. accepts only JSON containing at most 20 findings;
6. rejects unsupported authority fields, oversized values, invalid output, timeouts, and non-zero exits;
7. writes only `{ "findings": [...] }` to stdout.

The Kernel performs the final URL, scope, provenance, deduplication, and persistence validation again.

Hermes v0.20 `--safe-mode` is not compatible with this bridge because it disables the bundled backend plugins that supply public web search. The narrower invocation above preserves the official search backend while removing user config, rules, memory, skills and project plugins. Search output remains candidate material only.

## Remote authentic L1→L7 acceptance

`.github/workflows/hermes-live-public-web-acceptance.yml` runs the same product path on an isolated GitHub-hosted machine, so it does not install Hermes or another dependency on the founder's PC. It supports manual reruns and automatically qualifies same-repository pull requests plus `main` only when the live-acceptance boundary itself changes; fork pull requests are skipped. It pins:

- Hermes commit `ee4bb75b532e932a1055d9a710802a7435163b6a` (v0.20.0 source);
- every referenced GitHub Action by immutable commit;
- `uv` 0.9.28, Python 3.11, pnpm 11.11.0 and `ddgs` 9.14.4;
- Ollama 0.32.8 Linux archive SHA-256 `c10b76c39cb72908cc92dff314e80e32736c03f1287efb4b39e0b70fd600cc64`;
- reviewed Qwen3.5 2B model identity `324d162be6ca`.

The manual workflow needs no founder-owned provider credential. It installs a checksum-verified Ollama release on the disposable GitHub runner, pulls the reviewed `qwen3.5:2b` artifact, verifies its published model identity and tool capability, and exposes it only on loopback through Hermes's `custom` provider boundary. This smaller tool-capable model has a truthful 256K model context, satisfying Hermes's 64K minimum without overriding model metadata; it does not change Kernel authority or acceptance thresholds. The model and runtime disappear with the runner. The workflow still publishes only `.hephaestus/live-acceptance-report.json` after local redaction. A workflow definition or skipped/blocked run is not proof: acceptance requires the report itself to show all L1→L7 checks green on the tested SHA.

Hermes's isolated built-in defaults otherwise allow up to 500 turns, so Efesto does not use `--ignore-user-config` for this bridge. The freshly created `HERMES_HOME` cannot contain user configuration; Efesto writes the only config there with an exclusive create, refuses a pre-existing config, keeps rules/memory/project plugins disabled and limits the agent to at most eight turns. A deployment may select a stricter positive cap but cannot expand it beyond eight; remote live acceptance uses four.

The live control plane also uses strictly nested deadlines: the Hermes adapter must finish before the worker deadline, the worker before terminal observation ends, and all three before the outer GitHub job deadline. On timeout or excess output, the worker waits for the adapter process to close and escalates to a bounded forced kill if graceful termination is ignored; it never records mission failure while the provider process is still running.

When Hermes or its adapter exits non-zero, each process boundary retains only a bounded diagnostic after credential, token and absolute-path redaction. The same already-sanitized failure reason is included in the L1 report detail so provider compatibility failures remain actionable without publishing raw process output.

## Windows local configuration

Keep all values in the current PowerShell session or another ignored private environment file. Never commit tokens or private paths.

```powershell
$env:HEPHAESTUS_API_TOKEN = (Get-Content ".hephaestus\kernel-api-token" -Raw).Trim()
$env:HEPHAESTUS_HERMES_COMMAND = (Get-Command node).Source
$env:HEPHAESTUS_HERMES_ARGS_JSON = '["scripts/hermes-efesto-adapter.mjs"]'
$env:HEPHAESTUS_HERMES_EXECUTABLE = "C:\Users\Usuario\AppData\Local\hermes\hermes-agent\venv\Scripts\hermes.exe"
```

`HEPHAESTUS_KERNEL_URL` defaults to `http://127.0.0.1:4000` and remains loopback-only.

## Readiness check

Start the Kernel in one terminal:

```powershell
pnpm run kernel:serve
```

In the configured second terminal:

```powershell
pnpm run hermes:worker:doctor
```

The doctor verifies the Kernel URL, token presence, adapter command, arguments, and authenticated Kernel reachability without invoking Hermes or consuming credits.

## Execute one worker cycle

After creating an explicitly consented Goal mission in Efesto:

```powershell
pnpm run hermes:mission-worker
```

Possible results:

- `idle`: no queued mission exists;
- `completed`: authentic Hermes findings passed Kernel validation and the mission reached its persisted result state;
- `failed`: the worker reported a sanitized failure and the bounded retry policy remains in force.

## Acceptance evidence

Issue #101 is complete only after the user's authentic Hermes CLI executes a consented mission. Do not use a fake adapter, generated screenshot, or synthetic fixture as proof. Sanitized evidence may include mission identifiers, timestamps, state transitions, counts, and public URLs, but not raw private prompts, tool output, tokens, credentials, or session contents.
