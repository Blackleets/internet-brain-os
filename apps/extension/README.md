# Hephaestus browser extension

The extension captures visible public-page context and sends it only to the authenticated local Kernel.

## Secure local setup

1. Start the Kernel with `pnpm kernel:serve`.
2. On first start, copy the token printed by the Kernel. It is persisted privately in `.hephaestus/kernel-api-token` and reused across restarts.
3. Open the extension popup, paste it into **Local Kernel token**, and save it.

To supply your own token, set a private value of at least 32 characters:

```sh
HEPHAESTUS_API_TOKEN='replace-with-a-long-random-secret' pnpm kernel:serve
```

The extension accepts only loopback HTTP Kernel endpoints. Do not publish the token, commit it, or reuse an account password.

Rotate the generated token deliberately with:

```sh
HEPHAESTUS_ROTATE_API_TOKEN=1 pnpm kernel:serve
```

Copy the newly printed token into the extension immediately. Rotation invalidates the previous token.
