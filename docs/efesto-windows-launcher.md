# Efesto Windows Launcher

Issue: #121 — one-time Efesto bootstrap and single-button daily control.

## What the launcher owns

The launcher is a small Node-based Windows companion. It does not replace the extension and does not build the future Efesto browser. It owns only local process/bootstrap checks:

- starts the one-click Kernel (`apps/local-kernel/one-click-kernel.mjs`);
- detects Hermes from the existing Hermes install or `HEPHAESTUS_HERMES_EXECUTABLE`;
- checks a configured Obsidian vault for write access;
- detects port `4000` conflicts before starting another Kernel;
- records only its own launched process in `.hephaestus/efesto-launcher-process.json`;
- never prints or logs the API token, Hermes secrets, cookies, or authorization values.

## Shared bootstrap contract

Both the launcher and extension can use the same deterministic status object:

```json
{
  "schemaVersion": "efesto.bootstrap-status.v1",
  "kernel": "ready | offline | stale | port_conflict | failed",
  "hermes": "ready | missing | invalid | failed",
  "obsidian": "ready | not_configured | unwritable | failed",
  "pairing": "paired | required | invalid",
  "overall": "ready | needs_setup | failed",
  "message": "safe user-facing message",
  "diagnostics": {},
  "actions": []
}
```

The running Kernel exposes it at:

```text
GET http://127.0.0.1:4000/bootstrap/status
```

No credential is required for this readiness read, and it must not contain secret values.

## First-time setup

From the repo root on Windows:

```bash
pnpm install
pnpm efesto:launcher repair --obsidian-dir "C:\\Users\\Usuario\\OneDrive\\Documentos\\Obsidian Vault"
```

Or double-click:

```text
Efesto Launcher.cmd
```

If pairing is required, the Kernel prints a short one-use pairing code in the launcher window. Enter that code in the extension once. The long-lived token is stored privately by the Kernel and delivered through the pairing endpoint; it is not printed.

## Daily use

1. Run `Efesto Launcher.cmd` or `pnpm efesto:launcher repair`.
2. When the launcher reports `READY`, open/use the extension.
3. Press the central Efesto orb.

No daily PowerShell or token copy/paste should be needed after successful pairing.

## Commands

```bash
pnpm efesto:bootstrap
pnpm efesto:launcher status
pnpm efesto:launcher repair
pnpm efesto:launcher open
pnpm efesto:launcher shutdown
```

- `status`: prints the contract and diagnostics.
- `repair`: creates local directories if needed, starts the one-click Kernel if safe, and refuses to start over a non-Efesto port conflict.
- `open`: opens the browser extension surface target when ready. By default it opens `chrome://extensions/`; set `EFESTO_EXTENSION_URL` to a specific extension URL if needed.
- `shutdown`: only sends shutdown to the process recorded as owned by the launcher. It does not kill unrelated processes on port `4000`.

## Recovery rules

- `port_conflict`: another service is on port `4000`; close that service or choose a different port before retrying.
- `stale`: the launcher record points to an old/unreachable process; Repair removes only launcher-owned stale records before starting again.
- `missing Hermes`: install Hermes Agent or set `HEPHAESTUS_HERMES_EXECUTABLE`.
- `unwritable Obsidian`: repair permissions or configure another vault path.
- `pairing required`: pair the extension once; tokens remain hidden.

## Validation

```bash
pnpm test apps/local-kernel/efesto-bootstrap-status.test.mjs scripts/efesto-launcher-core.test.mjs apps/extension/src/local-transport.test.js apps/local-kernel/server.test.mjs
pnpm test
pnpm typecheck
pnpm build
```
