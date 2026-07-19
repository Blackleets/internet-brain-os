# Hephaestus browser extension

The extension captures visible public-page context and sends it only to the authenticated local Kernel.

## Secure local setup

1. Start the Kernel with `pnpm kernel:serve`.
2. On first start, copy the eight-character pairing code printed by the Kernel. It expires after five minutes and five failed attempts.
3. Open the extension popup, enter the code under **Pair this extension**, and select **Pair securely**.

The long-lived token is delivered once to extension-local storage and is never printed. It persists privately in `.hephaestus/kernel-api-token` with owner-only permissions and is reused across restarts.

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

To pair another local extension profile without rotating the credential, start once with `HEPHAESTUS_PAIRING=1`. Manual token entry remains available only as a recovery path.
