# Codex session — local Kernel receiver

Date: 2026-07-19

## Outcome

The browser extension can now deliver structured public-page context to a real local Hephaestus receiver. Accepted input is durably journaled before acknowledgement and duplicate retries receive the same receipt without additional writes.

## Safety properties

- Binds to loopback by default.
- Accepts only the known `hephaestus.page-context.v1` schema.
- Limits bodies to 32 KiB and individual text fields to extension capture bounds.
- Rejects credential-bearing source URLs.
- Rejects hostile browser origins and restricts CORS to Chrome extension and loopback origins.
- Requires `application/json`, preventing simple cross-origin form/text requests from creating inbox records.
- Does not expose internal error details.

## Deliberate boundary

The receiver does not yet create Case or Evidence objects. The durable inbox prevents knowledge loss while a separate typed projector is implemented and reviewed.

## Validation

- Typecheck passed.
- 95 tests passed.
- Build passed.
- HTTP integration tests cover acceptance, retry deduplication, and safe invalid-JSON rejection.
