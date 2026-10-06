# Change request: daily Windows startup and approved dashboard transport

Requested by the founder on 2026-10-05: keep the Kernel running after signing into the PC and stop requiring repeated token entry. Candidate `.87`, based on the unmerged #257 integration; public launch remains disabled.

## Design and authority

- Opt-in per-user Windows Startup shortcut invokes a noninteractive launcher command. Existing healthy instances are preserved; foreign processes/shortcuts are never terminated or overwritten. No administrator service, scheduled research, dependency installation, or model update runs at login.
- A paired extension explicitly grants `https://efesto-five.vercel.app/` access. Its service worker proxies allowlisted dashboard API requests to its own configured HTTP loopback. The real credential remains in trusted extension storage; discovery reveals only the public extension ID and loopback URL. A nonsecret in-memory transport selector replaces the token in the dashboard connection object.
- External messaging verifies origin, root page, top-level tab, no incognito and no extension sender. Other origins, frames, worker/claim/result routes, arbitrary hosts, redirects and caller headers are rejected. Body, response, concurrent-port and time limits bound resource use. Chat and SSE retain streaming semantics.
- Unchecking consent, changing pairing/host, or disconnecting from the web cancels active transport ports. Consent is disabled by default. Existing manual token/session-only connection remains compatible.
- Kernel authorization, Goal confirmations, capabilities, SUPPORT and durable-memory authority remain authoritative. Merely opening the web only reads state.

## Changed boundaries and risks

Windows entrypoints and launcher lifecycle live in `scripts/efesto-autostart.ps1`, `scripts/efesto-launcher*` and the three daily-start CMD files. The installation switch is explicit. Extension messaging lives in `apps/extension/src/dashboard-bridge.js`; public ID discovery is isolated in `dashboard-discovery.js`. The dashboard adapter is `apps/dashboard/lib/session/extension-bridge.ts`, used by the existing API and event clients. Kernel default origins now include the actual production site; explicit operator origin configuration still overrides defaults.

Trusting the production web origin authorizes its existing interactive API scope while consent is enabled. Compromise of that origin could issue allowed requests, although it cannot retrieve the token through this protocol or bypass Kernel gates. Revocation prevents subsequent access; it does not undo completed operations. Keep anti-framing/CSP protections and extension trusted-context storage. Browser/platform permission behavior and actual Windows login require real-device qualification; Linux mocks cannot prove them.

## Verification and rollback

Automated coverage includes sender/path rejection, consent and revocation, bounded transport, generic errors without credential disclosure, real HTTP between the extension worker and KernelClient with mocked Chrome messaging, NDJSON/SSE cancellation, mounted dashboard restore/disconnect and no automatic mutation, and launcher lifecycle decisions. Real Chromium acceptance now exercises the actual extension and production-origin discovery/consent/read/reopen/revocation protocol against a local HTTP fixture. Windows CI registers/removes actual temporary WScript shortcuts and verifies preservation of unrelated entries. CI's Hermes fixture is not authentic agent or founder-PC acceptance.

Before merging, inspect checks on the final unchanged commit, including Windows launcher and dashboard browser jobs. #257's earlier `.86` combined workflows ended unsuccessfully with several jobs cancelled before steps; an older green SHA does not qualify this change. Do not label a cancelled runner as an application failure without evidence.

Rollback: disable the startup shortcut from its owning installation, revoke the checkbox, and revert this transport/startup slice. Keep user stores and existing pairing intact. Manual launcher and manual web connection remain available. No public release or founder-PC installation is claimed by this PR.

Qualification follow-up 2026-10-06: fix the Windows negative-test subprocess handling after its expected rejection raised NativeCommandError; pin source-map-js 1.2.2 for GHSA-68fv-2mgg-jv7q rather than ignoring strict production audits. Browser download in the local environment returned an invalid/truncated archive; remote browser CI must qualify the added test.
