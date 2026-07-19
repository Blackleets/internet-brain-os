# Codex session — User security shield

Date: 2026-07-19

## Goal

Convert the first security hardening pass into a stable user-facing security layer: durable credentials, deliberate recovery/rotation, DNS-rebinding closure, and continuous dependency enforcement.

## Decisions

- A generated Kernel token is created once, stored in the Hephaestus data directory with `0600` permissions, and not printed again on ordinary restarts.
- Rotation requires `HEPHAESTUS_ROTATE_API_TOKEN=1`, creates a new token atomically, and invalidates the old extension credential.
- Public DNS results are validated and the selected public address is pinned into the connection. TLS still verifies the original hostname.
- CI operates with read-only repository permissions and fails on known production dependency advisories.

## Continuation

The next security UX should be an explicit local pairing ceremony with a short-lived approval code. It must not weaken loopback, Host, origin, or long-lived token checks.

## Validation

- 128/128 tests passed.
- Typecheck and build passed.
- Production dependency audit found no known vulnerabilities.
- Diff whitespace validation passed.
