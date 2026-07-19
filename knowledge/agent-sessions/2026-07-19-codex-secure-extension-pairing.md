# Codex session — Secure extension pairing

Date: 2026-07-19

## Goal

Remove routine long-lived token copying while keeping the local API authenticated and understandable for ordinary users.

## Protocol

1. First token creation, explicit rotation, or `HEPHAESTUS_PAIRING=1` creates an in-memory pairing session.
2. The Kernel prints an eight-character code and absolute expiry, never the persistent token.
3. The extension submits the code from its `chrome-extension://` origin over loopback.
4. A correct code delivers the persistent credential once into extension-local storage.
5. The session expires after five minutes, locks after five failures, and cannot be reused.

## Trust boundaries

Possession of the startup terminal and the trusted extension profile authorizes pairing. Ordinary localhost pages and originless processes cannot use the pairing endpoint. Manual token entry exists only for recovery.

## Continuation

A stable packaged extension ID should later become an explicit allowlist. Browser-level integration tests should verify the rendered popup flow in Chrome.

## Validation

- 133/133 tests passed.
- Typecheck and build passed.
- Production dependency audit found no known vulnerabilities.
- Diff whitespace validation passed.
