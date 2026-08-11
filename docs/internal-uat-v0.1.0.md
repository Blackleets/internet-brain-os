# Efesto v0.1.0 Internal UAT

Founder/internal validation only. Automated green is necessary but not sufficient for public launch.

## Release identity

- Channel: internal.
- Candidate source of truth: `INTERNAL_RELEASE.json` inside the exact artifact under test.
- Test only `efesto-v<INTERNAL_RELEASE.version>-windows.zip` from the matching successful Internal Test Package workflow and verify `SHA256SUMS.txt`.
- Windows entrypoint: `Install Efesto.cmd`.
- Public launch approved: **no**.
- Every previously used internal candidate is frozen and **must never be reused**. Any behavior, validation, UI, installer or packaging change advances `INTERNAL_RELEASE.json`.

## UAT-1 — clean Windows install

On a clean Windows profile, extract the exact candidate and run `Install Efesto.cmd`.

Pass only if the installer repairs Node.js 22+, pnpm 11.11.0 and frozen-lockfile dependencies; **builds the internal Shared runtime and trusted Kernel runtime** plus the trusted connectors runtime; builds the extension; starts/repairs Efesto; creates the owner-local desktop shortcut; and the Kernel reports **`alive: true`, `owned: true` and `verified: true`**. No Kernel token, model credential or Hermes boundary secret may be printed or embedded. Delete `packages/connectors/dist/index.js`, run the daily launcher, and verify the self-healing repair restores it before launch.

## UAT-2 — pairing, authority and shared surfaces

Pair the extension, open Forge/Missions/Finds/Models, the **Goal-first Control Center** and Replay Lab, then inspect authenticated `GET /api/goal-surfaces` and one Goal detail.

Pass only if:

- **Goal-first cross-surface G0** remains authoritative: Kernel-owned persisted Goal truth, Goal lifecycle separate from Mission work, and mobile-width does not imply remote phone → PC authority;
- **Shared Goal Truth v1** is `efesto.goal-surface.v1` with `sourceOfTruth: kernel`, authenticated read-only list/detail routes, explicit `legacy_radar` compatibility and no fabricated Goal state;
- Control Center and extension consume the same Shared Goal Truth semantics for queued, investigating, verifying, forged, completed and failed work;
- desktop and 390×844 layouts have no horizontal overflow; keyboard focus works; **work/data-flow motion appears only for observable active states**; **reduced-motion mode** preserves textual meaning;
- the Efesto **pixel-smith/brain visual identity** never obscures controls;
- Replay Lab remains read-only over durable-memory authority and **Memory Safety v1** preserves exact references;
- the extension presents `Authorize research` and the existing single confirmation is the explicit research authority act;
- after that trusted receipt exists, `web.search`, `web.read`, safe retry and restart recovery do not ask for another harmless-read prompt;
- no UI projection, Goal receipt or Mission lease grants purchase, login, form, message, file-mutation, payment or durable-memory authority;
- no blank/white/black dead screen blocks the journey.

## UAT-3 — real public-web economic Goal

In the normal Home composer, enter exactly one natural-language Goal; do not use hidden/internal fields:

> Find a good-quality drill in Spain for €18–€25 from reputable sellers.

The active product intentionally does not require category, price or location forms. After Goal creation, authenticated `GET /api/goals` may be inspected only to verify the Kernel-owned intent contract: the persisted Goal should include supported discovery categories covering **`offer` and `tool`**, and bounded keywords should retain **`18` and `25`**. `Spain` remains part of the natural Goal/search scope; no separate location control is required for this UAT.

Observe the real journey without manually calling internal worker endpoints:

`Goal → trusted research receipt → authorized web.search → Hermes safe search-only discovery → searchCandidates → authorized web.read → fetched public page → Case → Evidence → Opportunity/Find`

Pass only if:

- Hermes automatic discovery is certified read-only and uses an empty ephemeral home/cwd with one exclusive eight-turn config plus the equivalent of `--ignore-rules --toolsets search -z`, while memory and project plugins remain disabled; an incompatible Hermes runtime is visibly blocked rather than falling back to broad tools;
- search results are persisted first as candidates and **a search snippet is not Evidence**;
- the Kernel authorizes the registered `web.read` capability and re-fetches each candidate through the trusted public-web reader;
- private/loopback/link-local targets, credential URLs and redirect abuse fail closed;
- authority is rechecked after network I/O before persistence, so pausing/revising the Goal during a fetch cannot admit stale content;
- Evidence `rawText` comes from fetched page content, not Hermes output, and retains Mission/candidate/source provenance;
- every promoted Find retains Case/Evidence provenance and ranking is explainable;
- duplicate candidates, exact discovery replay and exact verification replay do not duplicate Case, Evidence or Find;
- zero search results complete calmly without a false forged state;
- no login, purchase, form submission, outreach, download or other external side effect occurs automatically.

Record Goal text, authorization time, discovery result count, verified Evidence count, promoted Find count, top source domain, time to first useful Find and any failure/retry observed.

## UAT-4 — persistence and replay

After UAT-3, restart Efesto at several safe points when practical: queued, after candidate discovery/verifying, and after completion.

Pass only if:

- queued authorized work resumes through the normal claim gate;
- a `waiting_for_agent` Mission only queues after the trusted adapter becomes ready and preserves its receipt;
- pending `verifying` candidates resume Kernel verification;
- an unexpired investigating lease is not stolen and recovery waits for normal expiry/reclaim;
- exact candidate/verification replay is idempotent and creates no duplicate Evidence/Find/Notification side effects;
- exact Memory Safety replay is safe, altered replay is rejected, malformed/corrupt authority fails closed and terminal memory is never reopened by an agent;
- Replay Lab exposes no mutation authority.

## UAT-5 — second value Goal

In the same one-line Home composer, enter:

> Find recent remote freelance work matching my skills at $20–$30/hour or more.

Do not add category fields manually. After Goal creation, the Kernel-owned intent should include discovery categories covering **`job` and `client`**, retain **`20` and `30`** as bounded keywords, and must **not** infer shopping `offer` merely because the Goal contains an hourly currency amount. Add the user's actual skill terms directly in the natural Goal when running the founder UAT. Keep the title within the 120-character Goal-title contract; recency, sourcing and duplicate avoidance remain verification criteria rather than hidden client metadata.

Pass only if public results are independently re-read, sourced, ranked and surfaced with provenance; the two product surfaces converge on the same persisted Mission state; and explicit feedback may change personalized ordering without rewriting objective Evidence relevance.

Record whether the result was genuinely useful enough to inspect or act on manually. This is the first practical input to Goal → Useful Find Rate and Repeat Goal Usage.

After the second distinct Goal is authorized, inspect the local product scorecard. Pass only if `Repeat Goal Usage` is measured from the Kernel-owned `local_installation` cohort, first-Goal activation remains a one-installation observation, and the UI does not present either as a multi-user or global rate. No account, device fingerprint or outbound telemetry identifier may be created.

## UAT-6 — failure handling

Safely exercise at least: network loss during verification, Kernel restart, an incompatible/missing Hermes runtime, and a private/loopback candidate URL.

Pass only if the product reports recoverable or policy-blocked state instead of fabricated success; retries do not duplicate irreversible work; attempts are not burned by authorization denial; UI motion settles; no unpersisted agent activity is claimed; secrets are not printed; and recovery returns to truthful ready state.

## Promotion decision

**Public launch remains blocked** until the complete automated package matrix and UAT-1 through UAT-6 pass on the **same immutable internal candidate**. When approved, create a separate public-release PR/tag from that exact green commit. Never rename or relabel an internal artifact into a public release.
