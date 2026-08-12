# Hephaestus Control Center

The Control Center is a presentation-only, local-first client for the existing
Hephaestus Kernel. It reads the same Kernel state as Efesto and Replay Lab; it
does not create a second store, bypass Kernel authority, or send data through a
cloud service.

## Start locally

From the repository root, start the loopback Kernel and then the dashboard in a
second terminal:

```bash
pnpm kernel:serve
pnpm dashboard:dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The web dashboard is
the primary owner surface: enter the one-time pairing code printed by the local
Kernel and it receives the private API credential over the local pairing route.
It then sends that credential as `x-hephaestus-token` for authenticated
`/api/*` requests. A manual token field remains as a recovery path.

The owner-only hosted dashboard can also pair with the loopback Kernel. The
Kernel permits the official Sites origin and loopback dashboard origins while
requiring a one-use code for pairing; arbitrary web origins remain forbidden.
Custom deployments must set a comma-separated
`HEPHAESTUS_DASHBOARD_ORIGINS` allowlist.

## Token handling

Enter the local Kernel token in the connection screen. By default it stays only
in the current browser tab's memory: it is not put in a URL, log, analytics
payload, build artifact, `localStorage`, or repository file. A 401 response
returns to the connection screen without clearing the last non-sensitive UI
state.

With the default Kernel data directory, the persistent token is stored at
`.hephaestus/kernel-api-token` relative to the repository root. If
`HEPHAESTUS_DATA_DIR` is set, it is instead at
`<HEPHAESTUS_DATA_DIR>/kernel-api-token`. Read it locally only when needed;
never commit or paste its contents into documentation, issues, or logs.

## Multi-model conversation

The bottom composer reads providers from the authenticated local Kernel. Users
may register loopback Ollama or an HTTPS OpenAI-compatible provider, choose only
models explicitly configured for that provider, and remove user-managed
providers later. Provider credentials are submitted to the loopback Kernel,
written only to its owner-private provider store, cleared from the form, and
never returned by list or chat responses.

An installation may also define environment-managed providers. Those appear in
the selector but cannot be deleted from the dashboard. No provider or model is
shown unless it is actually configured.

Conversation output streams incrementally and can be stopped by the user.
Completed exchanges are retained in a bounded owner-private Kernel conversation
store so they can be reopened after restarting the dashboard. Cancelled partial
responses are not committed. This history remains explicitly separate from
Evidence, Claims, Cases, and durable memory; every model response stays
`unverified_model_output` and `not_admitted`. Hermes remains the separately
confirmed research/tool execution layer.

## Current boundary

The Control Center provides an authenticated loopback connection, truthful
Kernel workspaces, and provider-neutral conversation. It is not yet a Knowledge
Graph projection or general scheduler. Conversation history may carry an
optional Case reference for navigation, but that reference does not admit the
conversation into Case Evidence or memory. Efesto remains the primary capture
and per-origin-consent surface, and Replay Lab remains the advanced forensic
surface.
