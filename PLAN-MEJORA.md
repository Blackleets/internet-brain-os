# Plan de Mejora — Efesto Release Closeout

> Canonical truth: `PROJECT_STATE.md`, live GitHub `main`, and the exact current CI run. This file is a planning view, not an older branch checkpoint.

## Current checkpoint - 2026-09-14

- PR #239 merged to `main` (`944048d`). Home/Hallazgos Kernel-supported Find chrome sealed.
- Extension now delivers Kernel NotificationGateway unread `find:supported:*` receipts via existing chrome.notifications (no new UI). Packaged zip must include `icons/efesto-notification.png` (chrome.notifications rejects missing/SVG-only packaging). Covering for watchtower Find/forged suppress stays after mark-read (state-agnostic covering pool); opportunities-empty forged cannot double-fire beside Kernel Find. Watchtower Find aviso, Living Forge `#forge-activity`, and popup `#mission-state` use max(inbox Finds, mission verificationResults SUPPORT) so empty/partial inbox cannot demote SUPPORT-proven forged missions to Research completed / kind:forged. Watchtower kind:find OS notify click opens Finds workspace (Kernel gateway fallback parity); attention/forged stay on missions. Kernel NotificationGateway OS notify uses generic lock-screen-safe copy (ARCHITECTURE.md) — never Find titles/bodies on chrome.notifications. After local OS delivery, markNotificationRead plus a separate state=unread list(limit) advances the unread window (unfiltered list keeps read in-page); covering stays on a state-agnostic list.
- Home forge-state-action forged chrome uses focused GoalSurface `findCount` (Kernel SUPPORT; verificationResults stripped on the surface) — not global inbox; zero-SUPPORT forged stays Investigación terminada. Home surfaceTitle/empty honor the same findCount when inbox empty. Agent Hub KernelWorkspaces `missionWorkspaceBadge`: zero-SUPPORT forged is `research_completed` (unavailable), not healthy forged; ActivityFeed labels `research_completed` as Investigación terminada. Extension `#mission-progress` (`missionJourney`): Forged stage completes only with Kernel SUPPORT (`verificationResults` / GoalSurface `findCount`) — zero-SUPPORT forged mirrors completed-without-Evidence (Verification complete, Forged pending). Central Forge Power orb: zero-SUPPORT forged is `research_completed` (neutral chrome + ledger), not green `completed` Completado. Living Forge `#living-forge` (forge-activity + Goal Surface): zero-SUPPORT forged stays `tone: idle` (not success celebrate), matching orb research_completed → idle. Agent Hub `#mission-state` / mission-card history: zero-SUPPORT forged uses `data-status=research_completed` (dim; not green Completado), matching orb/Living Forge. Home forge-state-action: zero-SUPPORT forged drops `phase-forged` green Completado chrome for `phase-research_completed` (label already Investigación terminada). `publicLaunchApproved` remains false.
- Next: packaged UAT-1 through UAT-6 on the exact candidate after Lewis asks; local scorecard already exists on Objetivos.
- No ADMITTED wiring, i18n, Intelligence Brief, PWA, extra IPs, or founder Kernel in this slice.

## Verified baseline — 2026-08-09

- Kernel authority, Evidence, contradiction/admission, exact replay and altered-replay rejection are implemented.
- Authentic Hermes ingestion and Agent Hub runtime validation are complete.
- Goal-first Control Center, living Efesto forge, extension workspaces and Replay Lab are wired to real Kernel state.
- Production dependency audit, architecture boundary guard, typecheck, Vitest, build, first-run verification, Chromium acceptance and Windows launcher/first-run gates are part of the required `main` baseline.
- Windows distribution is generated from an exact Git commit as an immutable internal artifact. Public launch approval is intentionally separate from CI.

## Release-closeout status

- [x] Close extension background-runtime gaps and regressions in `0.1.0-internal.6`.
- [x] Identify the missing release proof: source-tree installation tests did not install the exact generated ZIP artifact.
- [x] Add an exact-artifact Windows qualification harness with SHA-256 and BUILD_INFO binding.
- [x] Require extraction and installation from normal Windows paths containing spaces.
- [x] Require packaged first install on Windows 2022 and Windows 2025.
- [x] Require Shared, Kernel and extension runtimes to be built from the extracted candidate.
- [x] Require Kernel `alive`, `owned`, `verified` and Hermes readiness after installation.
- [x] Separate fresh unpaired installation from paired repair so first-run daemon handles are not misclassified as a batch-process failure.
- [x] Require first install to create the local private Kernel token and report pairing as required.
- [x] Require a second paired repair pass and prove the private Kernel token digest is unchanged.
- [x] Audit captured repair output for Kernel-token or Hermes-boundary credential leakage.
- [x] Make qualification shutdown use the trusted Node launcher directly through an isolated command rather than PowerShell-interpreted pnpm stderr.
- [x] Persist only sanitized failure diagnostics for CI investigation.
- [x] Add Gherkin and machine-checked release-contract coverage for packaged installation.
- [x] Freeze `0.1.0-internal.7` through `0.1.0-internal.10` as non-promotable qualification attempts rather than reusing their identities.
- [x] Qualify and merge the exact packaged candidate work from `0.1.0-internal.11`.
- [x] Enforce provider-neutral architecture boundaries through `pnpm architecture:check`.
- [x] Freeze `0.1.0-internal.11` after later source/runtime work made a new immutable candidate necessary before UAT.
- [ ] Qualify the new `0.1.0-internal.12` candidate on the final Memory Safety E1 SHA.
- [ ] Only then begin manual UAT-1 through UAT-6 on that exact `internal.12` artifact.
- [ ] Set `publicLaunchApproved=true` only after UAT passes on the same immutable candidate.

## Engineering sequence — Memory Safety

The bounded Memory Safety completion sequence is tracked as explicit GitHub issues:

1. **#185 — deterministic Kernel-owned quarantine signal evaluation and recommendations**;
2. **#187 — append-only quarantine recommendation persistence/read contracts without transition authority**;
3. **#188 — terminal-memory recovery review records without reopening terminal states**;
4. **#189 — repeated-failure aggregation into read-only prevention recommendations**;
5. **#190 — operator/read-model exposure with provenance and no Replay Lab write authority**;
6. **#191 — contract freeze plus adversarial regression/acceptance gates**.

Issue #186 separately defines the enterprise product scorecard. Product Design issue #192 is blocked until #191 closes.

## UAT promotion gate

The release is not publicly promotable until automated packaged qualification is green and `docs/internal-uat-v0.1.0.md` passes end to end on the same artifact:

1. clean Windows install;
2. browser pairing and real surfaces;
3. real public-web economic Goal;
4. persistence and replay;
5. second value Goal;
6. truthful failure handling/recovery.

## Enterprise operating rule

Engineering completion is not the same as business success. Efesto must also become measurable against:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Repeat Goal Usage;
- mission completion/failure rates;
- installation-to-first-Goal activation;
- Find usefulness/dismissal rates;
- zero altered-replay acceptance, unauthorized memory admission and credential/privacy leakage.

Initial measurement must remain local-first. Collective analytics require a separate opt-in privacy design.

## Engineering rules

1. **Kernel authority stays local-first and fail-closed.**
2. **Agents propose; the Kernel validates, admits and persists.**
3. **No fake UI state or synthetic release claims.**
4. **One bounded branch/PR at a time; never patch `main` directly.**
5. **Every shipped behavior or release-validation change advances the immutable internal candidate.**
6. **CI green is necessary, but public launch requires UAT evidence.**
7. **A generated package is not qualified until that exact package installs and repairs successfully.**
8. **Every major feature PR must state which enterprise scorecard dimension it improves.**
