# Efesto v0.1.0 Internal UAT

Founder/internal validation only. Passing CI is necessary but not sufficient for public launch.

## Release identity

- Channel: internal.
- Candidate source of truth: `INTERNAL_RELEASE.json` inside the exact artifact under test.
- Test only `efesto-v<INTERNAL_RELEASE.version>-windows.zip` from the matching successful Internal Test Package workflow and verify `SHA256SUMS.txt`.
- Windows entrypoint: `Install Efesto.cmd`.
- Public launch approved: **no**.
- Every previously used internal candidate is frozen and **must never be reused**; any runtime, validation, UI, installer or packaging change advances the version in `INTERNAL_RELEASE.json`.

## UAT-1 — clean Windows install

On a clean Windows profile, extract the exact candidate and run `Install Efesto.cmd`.

Pass only if the installer repairs Node.js 22+, pnpm 11.11.0 and frozen-lockfile dependencies; builds the internal Shared runtime and trusted Kernel runtime; builds the extension; starts/repairs Efesto; creates the desktop shortcut; and the Kernel reports `alive: true`, `owned: true` and `verified: true`. No Kernel token, provider credential or Hermes boundary secret may be printed or embedded.

## UAT-2 — pairing, authority and shared surfaces

Pair the extension, open Forge/Missions/Finds/Models, the Goal-first Control Center and Replay Lab, then inspect authenticated `GET /api/goal-surfaces` and one Goal detail.

Pass only if:

- Goal-first cross-surface G0 remains authoritative: Kernel-owned persisted Goal truth, Goal lifecycle separate from Mission work, and mobile-width does not imply remote phone → PC authority;
- Shared Goal Truth v1 is `efesto.goal-surface.v1` with `sourceOfTruth: kernel`, read-only list/detail routes, explicit `legacy_radar` compatibility and no fabricated unknown Goal;
- Control Center and extension consume the same Shared Goal Truth v1; read failures are explicit unavailable/error states;
- desktop and 390×844 layouts have no horizontal overflow, keyboard focus works, work/data-flow motion appears only for observable active states, and reduced-motion mode preserves textual meaning;
- the Efesto pixel-smith/brain visual identity never obscures controls;
- Replay Lab remains read-only over durable-memory authority and Memory Safety v1 preserves exact references;
- G4.1a never infers automation authority from an active Goal; authorization remains exact Goal-id/revision bound and `read_only_continuation` scoped;
- only trusted `interactive_user` or separately trusted `founder` receipts can satisfy user authority; agent/system actors, stale revisions, paused/terminal Goals, unresolved approval policies and R1/R2/R3 capabilities remain denied;
- G4.1b derives interactive authority only after existing token/origin/paired-extension checks; token-only requests and client-supplied authorization cannot self-promote;
- G4.1c1a authorizes the real registered `web.search` through CapabilityRegistry before automatic-read-only policy evaluation; `public_web_research` remains only a compatibility planning alias;
- pending search candidates block another discovery pass;
- G4.1c1b evaluates authorization before attempt increment or lease creation; denial persists a truthful block without burning an attempt, and a Kernel gate failure leaves Mission state unchanged;
- automatic lease eligibility also requires a technically certified read-only Hermes runtime; otherwise the reason is `runtime_read_only_unverified`;
- no Goal authorization, claim decision or Mission lease grants memory authority or permission for login, purchase, submission, outreach, download, destructive or financial side effects;
- no blank/white/black dead screen blocks the journey.

## UAT-3 — real public-web economic Goal

Use a real non-sensitive Goal, recommended:

> Find me a good-quality drill available in Spain between €18 and €25. Prefer reputable sellers and explain why the best matches fit the budget.

Pass only if the observed journey reaches:

`Goal → authorized web.search → authorized web.read → Case → Evidence → Opportunity ranking → Trigger/Notification`

URLs must be real public sources; a search snippet is not Evidence; every promoted Find retains Case/Evidence provenance; duplicates are suppressed; ranking is explainable; and no login, purchase, form submission or other external side effect occurs automatically.

Record Goal text, timestamp, search result count, Evidence count, promoted Find count, top source domain and notification outcome.

## UAT-4 — persistence and replay — Memory Safety v1

After UAT-3, restart Efesto and reopen the Goal/Mission/Find. Exercise exact replay, altered replay and supported malformed/corrupt safety fixtures.

Pass only if persisted state survives restart; exact replay is idempotent; altered replay is rejected; malformed or corrupt authority data fails closed; terminal memory cannot be reopened by an agent; Replay Lab exposes no mutation authority; and replay creates no duplicate Evidence/Notification side effects.

## UAT-5 — second value Goal

Use a second real Goal, recommended:

> Find remote freelance opportunities that match my skills and pay roughly $20–$30/hour or more. Prefer recent, clearly sourced opportunities and avoid duplicates.

Pass only if public results are sourced, ranked and notified with provenance, and explicit feedback can change personalized ordering without rewriting objective Evidence relevance.

## UAT-6 — failure handling

Safely exercise network loss, Kernel shutdown or another bounded failure.

Pass only if the product reports a recoverable failure instead of fabricated success; retry does not duplicate irreversible work; UI motion settles; no unpersisted agent activity is claimed; and recovery returns to truthful ready state.

## Promotion decision

Public launch remains blocked until automated packaged qualification and UAT-1 through UAT-6 pass on the **same immutable internal candidate**. When approved, create a separate public-release PR/tag from that exact green commit; never relabel an internal artifact as public.
