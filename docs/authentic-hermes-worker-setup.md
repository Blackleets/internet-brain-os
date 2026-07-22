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
4. invokes the authentic CLI with `hermes -z`, source `tool`, and bounded turns;
5. accepts only JSON containing at most 20 findings;
6. rejects unsupported authority fields, oversized values, invalid output, timeouts, and non-zero exits;
7. writes only `{ "findings": [...] }` to stdout.

The Kernel performs the final URL, scope, provenance, deduplication, and persistence validation again.

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
