# Plan de Mejora — Efesto Release Closeout

> Canonical truth: `PROJECT_STATE.md`, live GitHub `main`, and the exact current CI run. This file is a planning view, not an older branch checkpoint.

## Verified baseline — 2026-08-09

- Kernel authority, Evidence, contradiction/admission, exact replay and altered-replay rejection are implemented.
- Authentic Hermes ingestion and Agent Hub runtime validation are complete.
- Goal-first Control Center, living Efesto forge, extension workspaces and Replay Lab are wired to real Kernel state.
- Production dependency audit, typecheck, Vitest, build, first-run verification, Chromium acceptance and Windows launcher/first-run gates are green on the pre-fix `main` baseline.
- Windows distribution is generated as an immutable internal artifact. Public launch approval is intentionally separate from CI.

## Current release-closeout work

- [x] Remove duplicate extension runtime-message routing for Auto Radar commands.
- [x] Remove the legacy auto-capture dependency on an out-of-scope popup message variable.
- [x] Use the supported Manifest V3 `chrome.action.setBadgeText` API.
- [x] Add regression tests and Gherkin acceptance coverage for the extension background runtime.
- [x] Advance the immutable candidate from `0.1.0-internal.5` to `0.1.0-internal.6`.
- [x] Synchronize release/demo documentation with closed Hermes proof obligations.
- [ ] Merge only after the full required CI + Chromium + Windows workflows are green for this exact code state.
- [ ] Run UAT-1 through UAT-6 on the resulting `internal.6` Windows artifact.
- [ ] Set `publicLaunchApproved=true` only after that UAT passes on the same immutable candidate.

## UAT promotion gate

The release is not publicly promotable until `docs/internal-uat-v0.1.0.md` passes end to end on the same artifact:

1. clean Windows install;
2. browser pairing and real surfaces;
3. real public-web economic Goal;
4. persistence and replay;
5. second value Goal;
6. truthful failure handling/recovery.

## Engineering rules

1. **Kernel authority stays local-first and fail-closed.**
2. **Agents propose; the Kernel validates, admits and persists.**
3. **No fake UI state or synthetic release claims.**
4. **One bounded branch/PR at a time; never patch `main` directly.**
5. **Every shipped behavior change advances the immutable internal candidate.**
6. **CI green is necessary, but public launch requires UAT evidence.**
