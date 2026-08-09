# Efesto v0.1.0 Internal UAT

This checklist is for founder/internal validation only. Passing CI is necessary but not sufficient for public launch.

## Release identity

- Channel: internal
- Candidate: `0.1.0-internal.11`
- Windows entrypoint: `Install Efesto.cmd`
- Public launch approved: **no**
- `0.1.0-internal.7`, `0.1.0-internal.8`, `0.1.0-internal.9`, and `0.1.0-internal.10` are frozen as non-promotable automated-qualification candidates and must not be reused.
- Test only the artifact produced from the exact `main` commit under review.
- Automated packaged-candidate qualification on Windows 2022 and Windows 2025 must be green before manual UAT begins.

## UAT-1 — clean Windows install

1. Use a clean Windows user profile or a machine where Efesto has not been configured.
2. Use only the `efesto-v0.1.0-internal.11-windows.zip` artifact from the successful `Internal Test Package` workflow on `main` after both packaged-install qualification jobs pass.
3. Verify the artifact SHA-256 against `SHA256SUMS.txt` from the same workflow run.
4. Extract the ZIP to a normal user-writable folder.
5. Double-click `Install Efesto.cmd`.

Pass only if:

- the installer self-checks/repairs Node.js 22+, pnpm 11.11.0 and frozen-lockfile dependencies;
- the installer builds the internal Shared runtime and trusted Kernel runtime from the source package before launch;
- the extension build completes;
- the trusted local launcher starts or repairs Efesto;
- the Kernel reports `alive: true`, `owned: true` and `verified: true` after startup;
- a desktop shortcut is created for the current user;
- no Kernel token, provider credential or Hermes boundary secret is printed or embedded;
- the user does not need to type package-manager commands manually.

## UAT-2 — browser pairing, identity and surfaces

1. Open `chrome://extensions` in Chrome/Chromium.
2. Enable Developer mode.
3. Load unpacked from `apps/extension/dist` inside the extracted package.
4. Pair/connect the extension to the local Kernel when prompted.
5. Open Forge, Missions, Finds and Models.
6. Open the Control Center and Replay Lab from the local product flow.
7. Observe the Home/Goal surface while offline, ready and during one real mission.

Pass only if:

- Kernel readiness is truthful;
- pairing succeeds without exposing secrets;
- all four extension workspaces render;
- the Goal-first Control Center loads as an authenticated local client on desktop and mobile-width layouts;
- the Efesto pixel-smith/brain visual identity renders without obscuring controls or causing horizontal overflow;
- work/data-flow motion appears only for observable active states such as queued, investigating, verifying or model thinking, and does not imply work while offline or failed;
- reduced-motion mode remains usable without continuous decorative animation;
- Replay Lab is readable but cannot mutate durable-memory authority;
- no blank/white/black dead screen blocks the journey.

## UAT-3 — real public-web economic Goal

Use a real, non-sensitive public-web Goal. Recommended first Goal:

> Find me a good-quality drill available in Spain between €18 and €25. Prefer reputable sellers and explain why the best matches fit the budget.

Pass only if the observed journey reaches:

`Goal → authorized web.search → authorized web.read → Case → Evidence → Opportunity ranking → Trigger/Notification`

and:

- returned URLs are real public sources;
- every promoted Find retains Case/Evidence provenance;
- ranking is explainable;
- duplicates are suppressed;
- no login, purchase, form submission or other external side effect occurs automatically;
- an irrelevant or weak result is not silently promoted as trusted memory.

Record at least: Goal text, timestamp, number of search results, number of Evidence records, number of promoted Finds, top result URL/domain, and whether a notification was emitted.

## UAT-4 — persistence and replay

1. Complete UAT-3.
2. Close the extension/dashboard and stop Efesto normally.
3. Restart using the Efesto desktop shortcut.
4. Re-open the Goal/Mission/Find.
5. Exercise an exact replay where the product exposes it, then attempt an altered replay in the supported forensic path.

Pass only if:

- persisted mission/evidence state survives restart;
- durable memory-authority receipts reconstruct without corruption;
- exact replay is idempotent;
- altered replay is rejected;
- no duplicate Evidence/Notification side effects appear from the exact replay.

## UAT-5 — second value Goal

Recommended second Goal:

> Find remote freelance opportunities that match my skills and pay roughly $20–$30/hour or more. Prefer recent, clearly sourced opportunities and avoid duplicates.

Pass only if real public results are sourced, ranked and notified with provenance, and explicit user feedback changes personalized ordering without rewriting objective Evidence relevance.

## UAT-6 — failure handling

During an internal test, deliberately exercise at least one safe failure such as disconnecting the network before a read/search or stopping the Kernel before opening the extension.

Pass only if:

- the product reports a recoverable failure instead of fabricating success;
- retry does not duplicate irreversible work;
- the UI does not claim agent activity that was not persisted;
- the forge visual returns to a truthful offline/failed state rather than continuing active-work motion;
- after recovery the Kernel returns to a truthful ready state.

## Promotion decision

Public launch remains blocked until automated packaged qualification is green and UAT-1 through UAT-6 are all marked PASS on the same immutable internal candidate or on a newer candidate that has rerun all affected checks.

A candidate version must never be reused after a user-visible, installer, runtime or validation change lands. Advance the internal candidate number instead so test evidence always maps to one code state.

When approved, create a separate public-release PR/tag from the exact green commit. Do not convert an internal artifact into a public release by renaming it.
