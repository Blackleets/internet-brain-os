# Efesto Vercel preview

Efesto's Vercel deployment is a preview of the real `apps/dashboard` client
from the `Blackleets/internet-brain-os` repository. It is not a hosted Kernel,
database, agent worker, or memory service.

## Git-backed project settings

- Repository: `Blackleets/internet-brain-os`
- Project: `efesto`
- Root directory: `apps/dashboard`
- Include source files outside of the Root Directory: enabled
- Framework: Next.js
- Source: the selected GitHub branch or pull request, never a manually assembled subset
- Production: do not promote a preview until the exact revision has passed the repository gates and the founder approves it

The app-level `apps/dashboard/vercel.json` pins framework detection. Vercel's
Root Directory remains a project setting rather than a `vercel.json` property.
The complete repository must be available to the build because the dashboard
extends the workspace `tsconfig.base.json` and uses the root pnpm lockfile.

## Local Kernel boundary

The hosted dashboard can render without a Kernel, but authenticated data still
belongs to the user's loopback Kernel. The Kernel listens only on a loopback
host and accepts a hosted dashboard origin only when it is explicitly present in
`HEPHAESTUS_DASHBOARD_ORIGINS`.

For a confirmed preview origin, configure the local Kernel with that exact
origin, for example:

```text
HEPHAESTUS_DASHBOARD_ORIGINS=https://the-exact-efesto-preview.vercel.app
```

Use a stable custom origin when possible. Do not allow `*.vercel.app`, do not
put the Kernel token in Vercel, URLs, source files, analytics, or screenshots,
and do not expose the loopback Kernel to the public internet. If the origin is
not allowlisted, the honest expected result is a visible connection/CORS
failure rather than a cloud fallback.

Current Chromium browsers may also show a Local Network Access permission
prompt when a public HTTPS preview connects to loopback. Grant that permission
only to the confirmed Efesto origin. Denial must remain a visible connection
failure and must never trigger a cloud proxy or a broader origin rule. See the
[Chrome Local Network Access guidance](https://developer.chrome.com/blog/local-network-access).

## Verification contract

1. Confirm the deployment revision matches the GitHub branch or PR.
2. Open the preview and verify the connection screen renders.
3. With the local Kernel running and the exact origin allowlisted, connect using
   the owner-private token held only in the browser tab; grant the browser's
   Local Network Access permission to that confirmed origin if prompted.
4. Verify a read-only Overview request, an unauthorized `401`, and the local
   Kernel's origin rejection for an unlisted origin.

A green Vercel build proves only that the dashboard artifact builds and
renders. It does not prove authentic Hermes execution, Evidence admission,
Opportunity creation, Obsidian projection, or public-scale readiness.
