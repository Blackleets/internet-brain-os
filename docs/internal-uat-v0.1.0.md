# Efesto v0.1.0 Internal UAT

This checklist is for founder/internal validation only. Passing CI is necessary but not sufficient for public launch.

## Release identity

- Channel: internal
- Candidate: `0.1.0-internal.40`
- Windows entrypoint: `Install Efesto.cmd`
- Public launch approved: **no**
- `0.1.0-internal.7` through `0.1.0-internal.39` are frozen as non-promotable automated-qualification or superseded pre-UAT candidates and must not be reused.
- Test only the artifact produced from the exact `main` commit under review.
- Automated packaged-candidate qualification on Windows 2022 and Windows 2025 must be green before manual UAT begins.

## UAT-1 — clean Windows install

1. Use a clean Windows user profile or a machine where Efesto has not been configured.
2. Use only the `efesto-v0.1.0-internal.40-windows.zip` artifact from the successful `Internal Test Package` workflow on `main` after both packaged-install qualification jobs pass.
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
8. Using an authenticated internal client, inspect `GET /api/goal-surfaces` and one `GET /api/goal-surfaces/:goalId` response.

Pass only if:

- Kernel readiness is truthful;
- pairing succeeds without exposing secrets;
- all four extension workspaces render;
- the Goal-first Control Center loads as an authenticated local client on desktop and mobile-width layouts;
- Goal-first cross-surface G0 remains the design contract: Kernel-owned persisted Goal truth, Mission state kept distinct, and no fabricated cross-device authority;
- Shared Goal Truth v1 returns schema `efesto.goal-surface.v1` with `sourceOfTruth: kernel`;
- the Shared Goal Truth list/detail routes require the existing Kernel token and preserve extension identity authorization;
- Goal lifecycle and Mission work state remain separate fields in the projection;
- legacy radar Goals are explicitly labelled `legacy_radar` compatibility rather than being misrepresented as UniversalGoal v2;
- an unknown Goal returns not found instead of fabricated state;
- no POST/write route exists under `/api/goal-surfaces`;
- source-tree launcher startup does not require `packages/kernel/dist` before the first Goal-surface read; packaged installs still build the trusted Kernel runtime before launch;
- the Control Center Home/Living Forge consumes Shared Goal Truth v1 for persisted work-state presentation and does not override it with conflicting legacy Mission interpretation;
- the extension parser, transport, Living Forge and Goal chips consume the same Kernel-owned Shared Goal Truth contract;
- extension Goal chips preserve Kernel ordering, explicit compatibility labels, per-Goal `workState` and projected `canResearch`;
- the existing explicit `Authorize Hermes to research this Goal once?` confirmation and existing `startGoalResearch` writer remain unchanged through G4.1b;
- Shared Goal Truth read failure becomes an explicit unavailable/error state instead of stale legacy success or an empty fabricated success list;
- legacy Mission history remains a read-only compatibility ledger, not Goal authority;
- `completed` without persisted `forged` remains visually calm and is not presented as forged Evidence;
- work/data-flow motion appears only for observable active states;
- reduced-motion mode remains usable without continuous decorative animation and preserves textual state meaning;
- desktop and 390×844 mobile-width web acceptance remain green with no horizontal overflow;
- mobile-width support does not imply arbitrary phone → PC Kernel remote authority;
- automatic Goal-chip refresh follows persisted Mission revision changes without adding an independent unbounded polling loop;
- no new Goal, approval, capability or memory-authority writer was introduced by G3/G4.1a-b;
- the Efesto pixel-smith/brain visual identity renders without obscuring controls;
- Replay Lab remains readable but cannot mutate durable-memory authority;
- Memory Safety v1 projections preserve exact references and distinguish persisted records, deterministic interpretations and human decisions;
- G4.1a automatic read-only policy never treats an active Goal alone as authorization;
- G4.1a accepts only `interactive_user` or separately trusted `founder` authorization actors, never `agent` or `system`;
- an approved `efesto.goal-execution-authorization.v1` receipt remains bound to the exact Goal id and revision with `read_only_continuation` scope;
- changing the Goal revision, pausing/terminating the Goal, using an agent/system approval actor, or presenting a single-action receipt denies automatic continuation;
- automatic continuation is eligible only for an available `r0_observe` capability whose consent policy is not `always`;
- R1/R2/R3 capabilities and Goal policies that require every action or unresolved custom approval remain separately approval-gated;
- an eligible G4.1a decision does not itself authorize a capability, create/claim a Mission, approve side effects, or mutate memory authority;
- G4.1b derives `interactive_user` authority only after the existing server token/origin checks and, for extension origins, the existing paired-extension identity check;
- a token-bearing request with no trusted interactive Origin may preserve manual Mission compatibility but receives no automatic-continuation receipt;
- client-supplied `authorization` objects are ignored and cannot declare themselves as user authority;
- an allowed Control Center or authorized extension confirmation can persist a deterministic `efesto.goal-execution-authorization.v1` receipt with a server-derived surface class;
- a live pre-G4 Mission may receive a receipt only after a new trusted interactive confirmation, without creating a duplicate Mission;
- an idempotent repeat confirmation preserves an existing receipt, while an explicit terminal retry receives a fresh receipt;
- lease reconciliation preserves authorization provenance and never widens its scope;
- G4.1b still does not broaden or gate the automatic Hermes worker; worker enforcement remains G4.1c;
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

## UAT-4 — persistence and replay — Memory Safety v1

1. Complete UAT-3.
2. Close the extension/dashboard and stop Efesto normally.
3. Restart using the Efesto desktop shortcut.
4. Re-open the Goal/Mission/Find.
5. Exercise an exact replay where the product exposes it, then attempt an altered replay in the supported forensic path.
6. Exercise supported malformed/corrupt Memory Safety input fixtures or equivalent internal diagnostic paths without modifying production data.

Pass only if:

- persisted mission/evidence state survives restart;
- durable memory-authority receipts reconstruct without corruption;
- durable quarantine recommendations reconstruct without corruption or duplicate exact replays;
- malformed, null, scalar or structurally invalid Memory Safety v1 inputs fail closed with controlled boundary errors rather than coercion or raw `TypeError` behavior;
- corrupt quarantine/recovery integrity data is treated as invalid and never as current authorization;
- stale quarantine recommendations remain historical records rather than being silently rewritten;
- recovery reviews for terminal memory reconstruct with integrity and do not reopen the terminal memory id;
- any approved recovery references a distinct new candidate memory identity under the recorded policy/reviewer;
- an agent or automated reviewer cannot approve terminal-memory recovery;
- repeated-failure prevention remains read-only and cites exact persisted failure/reference IDs without inferring hidden intent;
- Replay Lab/operator Memory Safety query uses read/list dependencies only and exposes no memory-transition, recovery-approval, policy-mutation or capability-mutation command;
- Memory Safety projection does not mix records belonging to a different memory identity;
- exact replay is idempotent;
- altered replay is rejected;
- no duplicate Evidence/Notification side effects appear from the exact replay.

## UAT-5 — second value Goal

Recommended second Goal:

> Find remote freelance opportunities that match my skills and pay roughly $20–$30/hour or more. Prefer recent, clearly sourced opportunities and avoid duplicates.

Pass only if real public results are sourced, ranked and notified with provenance, and explicit user feedback changes personalized ordering without rewriting objective Evidence relevance.

## UAT-6 — failure handling

During an internal test, deliberately exercise at least one safe failure such as disconnecting the network before opening the extension or stopping the Kernel before a Shared Goal Truth read.

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
