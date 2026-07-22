# Hermes Mission Worker

The worker connects an external Hermes adapter to Efesto's local leased Goal-research contract. It does not install Hermes or simulate discovery.

```bash
export HEPHAESTUS_API_TOKEN="your-local-kernel-token"
export HEPHAESTUS_HERMES_COMMAND="/absolute/path/to/hermes-efesto-adapter"
export HEPHAESTUS_HERMES_ARGS_JSON='["--json"]'
pnpm hermes:mission-worker
```

The executable is spawned with `shell: false`. It receives one `efesto.hermes-mission.v1` JSON object on standard input and must return `{ "findings": [...] }` on standard output. Efesto accepts at most 20 findings and revalidates them before Evidence or Opportunity projection. The adapter never receives the Kernel token, browsing history, private preferences, cookies, or Obsidian contents.
