# Codex session — Local capture security hardening

Date: 2026-07-19

## Scope

Threat-model and test the browser extension → local HTTP receiver → knowledge store → Ollama → Obsidian path. Preserve the evidence-first and local-first architecture.

## Confirmed findings

| Severity | Boundary | Finding | Resolution |
| --- | --- | --- | --- |
| High | Local HTTP API | Any local process or suitably permitted extension could read Cases or submit Evidence without authentication. | Require a high-entropy token on every API route and compare it in constant time. |
| High | Obsidian projection | Page/model-controlled strings were emitted as active Markdown, enabling hostile embeds, links, and markup in the vault. | Escape inline content and render raw Evidence as inert indented code. |
| Medium | Network boundary | Listener configuration and request `Host` could permit unintended non-loopback exposure. | Refuse non-loopback listeners and Host headers. |
| Medium | Extension transport | A configured remote HTTP(S) endpoint could receive captured Evidence. | Accept only loopback HTTP endpoints. |
| High | Public web ingestion | Connector and CLI fetchers could reach private/link-local services or follow redirects to them (SSRF). | Validate DNS/address scope before the initial request and every manual redirect. |
| Medium | Public web ingestion | Entire remote response bodies were buffered without a hard limit. | Enforce a streaming 2 MiB maximum. |
| Low | Browser caching | API responses did not explicitly prohibit caching. | Add `Cache-Control: no-store`. |

## Dependency result

`pnpm audit --prod` reported no known vulnerabilities on 2026-07-19. This is a point-in-time result, not a permanent guarantee.

## Validation

- 125/125 tests passed.
- Typecheck and build passed.
- Diff whitespace validation passed.

## Residual trust

The local operating-system account, browser profile, installed extension code, configured Obsidian plugins, and Ollama model remain trusted boundaries. DNS resolution is checked before requests, but future network adapters should pin validated addresses at connection time to fully remove DNS rebinding time-of-check/time-of-use risk. Future work should also add explicit token rotation/pairing and CI security automation.
