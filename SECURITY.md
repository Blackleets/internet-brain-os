# Security

Internet Brain OS is local-first and evidence-first. Security controls protect the user's local API, captured Evidence, public-network ingestion, model boundary, and Obsidian vault.

## User security baseline

- The Kernel listens only on loopback and rejects non-local `Host` values.
- Every `/api/*` request requires a high-entropy token.
- Generated tokens persist in `.hephaestus/kernel-api-token` with owner-only permissions (`0600`).
- Extension pairing uses an eight-character, five-minute, one-use code with a five-attempt lockout; the long-lived token is never printed.
- Successful pairing allowlists the exact Chrome extension ID. Other extensions are rejected even with the correct token.
- The extension sends Evidence only to loopback HTTP endpoints.
- Ollama calls accept only loopback HTTP endpoints.
- Captured and generated text is rendered inert in Obsidian notes.
- Public-page ingestion blocks private/link-local networks, pins validated DNS addresses, limits redirects, and caps bodies at 2 MiB.
- CI runs tests, typecheck, build, and a production dependency advisory audit.

## Token operations

Never commit or share `.hephaestus/kernel-api-token`. Rotate it if exposed:

```sh
HEPHAESTUS_ROTATE_API_TOKEN=1 pnpm kernel:serve
```

Then replace the saved token in the extension popup. A custom token may be supplied through `HEPHAESTUS_API_TOKEN` and must contain 32–512 characters.

Rotation also clears authorized extension identities. Pair the trusted extension again with the newly printed code; this revokes previously authorized browser profiles as part of incident recovery.

Pair an additional trusted local browser profile without rotating the token:

```sh
HEPHAESTUS_PAIRING=1 pnpm kernel:serve
```

## Trusted boundaries

The operating-system account, browser profile, extension package, local Ollama installation/model, and enabled Obsidian plugins remain trusted. Keep them patched and do not install unknown extensions or plugins.

## Reporting a vulnerability

Do not include real tokens, private Evidence, vault contents, or personal data in a public issue. Report the smallest reproducible description and use a private repository security-advisory channel when available.
