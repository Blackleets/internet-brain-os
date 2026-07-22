# Authentic Hermes Worker Setup

This guide prepares Efesto's Agent Hub worker to invoke the user's authentic Hermes runtime without granting Hermes Kernel authority.

## Security boundary

The worker sends one bounded `efesto.hermes-mission.v1` JSON object to the configured adapter over stdin. The adapter may invoke Hermes, but it must return only:

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

## Local configuration

Use `examples/hermes-worker.env.example` as a reference. Keep the real values outside Git.

Required variables:

- `HEPHAESTUS_KERNEL_URL`: loopback HTTP only. Defaults to `http://127.0.0.1:4000`.
- `HEPHAESTUS_API_TOKEN`: private token stored by the local Kernel.
- `HEPHAESTUS_HERMES_COMMAND`: executable thin adapter for the user's real Hermes installation.
- `HEPHAESTUS_HERMES_ARGS_JSON`: optional JSON array of adapter arguments.

## Adapter contract

The adapter must:

1. Read exactly one JSON object from stdin.
2. Confirm `schemaVersion` equals `efesto.hermes-mission.v1`.
3. Use only the authorized mission scope supplied by Efesto.
4. Invoke the authentic Hermes runtime without shell interpolation.
5. Write exactly one result JSON object to stdout.
6. Write diagnostic logs only to stderr.
7. Exit non-zero on runtime or conversion failure.
8. Never return credentials, raw private sessions, local URLs, private-network URLs, or Kernel authority fields.

The worker enforces a four-minute default timeout, a 512 KiB total output limit, and a maximum of 20 findings.

## Readiness check

Start the local Kernel, export the private variables, and run:

```bash
pnpm hermes:worker:doctor
```

The doctor verifies:

- loopback-only Kernel URL;
- token presence without printing it;
- valid JSON adapter arguments;
- adapter executable resolution;
- authenticated Kernel reachability.

It does not invoke Hermes and does not consume model credits.

## Execute one worker cycle

After creating a consented Goal mission in Efesto:

```bash
pnpm hermes:mission-worker
```

Possible results:

- `idle`: no queued mission exists;
- `completed`: authentic Hermes findings passed Kernel validation and the mission reached its persisted result state;
- `failed`: the worker reported a sanitized failure and the bounded retry policy remains in force.

## Acceptance evidence

Issue #101 is complete only after a real configured Hermes runtime executes a consented mission. Do not use a fake adapter, generated screenshot, or synthetic fixture as proof. Sanitized evidence may include mission identifiers, timestamps, state transitions, counts, and public URLs, but not raw private prompts, tool output, tokens, credentials, or session contents.
