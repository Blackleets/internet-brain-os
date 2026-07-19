# Hephaestus browser extension

The extension captures visible public-page context and sends it only to the authenticated local Kernel.

## Secure local setup

1. Start the Kernel with `pnpm kernel:serve`.
2. Copy the runtime token printed by the Kernel.
3. Open the extension popup, paste it into **Local Kernel token**, and save it.

For a stable token across restarts, set a private value of at least 32 characters:

```sh
HEPHAESTUS_API_TOKEN='replace-with-a-long-random-secret' pnpm kernel:serve
```

The extension accepts only loopback HTTP Kernel endpoints. Do not publish the token, commit it, or reuse an account password.
