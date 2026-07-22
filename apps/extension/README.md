# Efesto Opportunity Radar

Efesto is the primary browser experience for Internet Brain OS. The user explicitly authorizes a public site, and the extension can then preserve pages from that site automatically in the user's private loopback Kernel while they browse.

The Kernel separates ordinary Evidence from strong opportunities across work, funding, clients, savings, food, public aid, learning, events, housing, travel, collaboration, rewards, and useful tools. Promoted leads appear in the local Opportunity Inbox with their concrete benefit type, explainable relevance, source, a detected deadline when present, and a cautious next action. They are also written as separate Opportunity notes in the user's Obsidian-compatible vault. Classification is a local lead filter, not proof that an offer is safe or suitable.

Users can add private Goals with a category, keywords, optional location, and priority. Goals stay in the local Kernel, synchronize to the user's own vault, and add an explainable personalization layer to Inbox ordering without replacing the original Evidence relevance score. They do not start external browsing until an Agent Hub adapter is explicitly connected and enabled.

Mission Watchtower checks the authenticated loopback Agent Hub once per minute while the popup is closed. It notifies only on newly observed terminal transitions for already-known missions, uses generic lock-screen-safe copy, and keeps a bounded local unread result center. It never exposes Goal or finding content in notifications and cannot advance mission state.

Privacy defaults:

- authorization is per origin and revocable;
- login, account, payment, wallet, messaging, and settings paths are blocked;
- sensitive query keys and user selections are never auto-captured;
- repeat capture is limited by a local cooldown;
- Evidence and Obsidian notes stay in the user's local instance;
- manual capture remains available as an explicit fallback.

## Secure local setup

1. Start the Kernel with `pnpm kernel:serve`.
2. On first start, copy the eight-character pairing code printed by the Kernel. It expires after five minutes and five failed attempts.
3. Open the extension popup, enter the code under **Pair this extension**, and select **Pair securely**.

The long-lived token is delivered once to extension-local storage and is never printed. It persists privately in `.hephaestus/kernel-api-token` with owner-only permissions and is reused across restarts.
The Kernel also stores the exact paired Chrome extension ID in `.hephaestus/authorized-extensions.json`; other extensions are denied even if they obtain the token.

To supply your own token, set a private value of at least 32 characters:

```sh
HEPHAESTUS_API_TOKEN='replace-with-a-long-random-secret' pnpm kernel:serve
```

The extension accepts only loopback HTTP Kernel endpoints. Do not publish the token, commit it, or reuse an account password.

Rotate the generated token deliberately with:

```sh
HEPHAESTUS_ROTATE_API_TOKEN=1 pnpm kernel:serve
```

Enter the newly printed pairing code into the extension immediately. Rotation invalidates the previous token.
Rotation also clears the previous extension allowlist, so only profiles paired again remain authorized.

To pair another local extension profile without rotating the credential, start once with `HEPHAESTUS_PAIRING=1`. Manual token entry remains available only as a recovery path.
