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

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The dashboard connects
only to a loopback Kernel and sends the token as `x-hephaestus-token` for
authenticated `/api/*` requests.

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

## Phase 1 boundary

Phase 1 provides an authenticated loopback connection and a truthful Overview
of currently available Kernel read models. It is not a Knowledge Graph
implementation, a full Investigations workflow, or a scheduler. Efesto remains
the primary capture and per-origin-consent surface, and Replay Lab remains the
advanced forensic surface.
