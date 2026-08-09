# Product Star Roadmap

This roadmap turns the verified HEPHAESTUS / Efesto foundation into a focused release and product plan. It must follow `PROJECT_STATE.md` and live CI when newer than this file.

The goal is not to add random features. The goal is to make the evidence-first intelligence loop useful, trustworthy, easy to install, measurable, and easy to demonstrate without weakening Kernel authority.

## North star

```text
Goal
→ authorized research
→ Case + Evidence
→ Kernel verification
→ Opportunity ranking
→ Trigger / notification
→ controlled memory only after Kernel gates
```

## Verified foundation — 2026-08-09

- Authentic bounded Hermes runtime and provider-neutral Kernel boundary.
- Exact replay safe; altered replay rejected.
- Goal → public research → Evidence → Opportunity → Notification Golden E2E.
- Goal-first Control Center, browser extension, Replay Lab and living Efesto forge.
- One-click/self-healing Windows setup and exact immutable package qualification.
- Architecture guard, strict dependency audit, typecheck, Vitest, build, first-run, Chromium and Windows release gates.

## Phase E — Memory Safety v1

Status: **final contract-freeze gate active**.

- [x] #185 — deterministic quarantine-signal evaluation and read-only recommendation identity.
- [x] #187 — append-only durable recommendation persistence, integrity reconstruction, exact replay and fresh/stale assessment without transition authority.
- [x] #188 — terminal-memory recovery review records requiring human/founder decisions under policy version; approved recovery names a distinct new candidate and never reopens the terminal memory ID.
- [x] #189 — repeated persisted failures produce deterministic `read_only` prevention guidance with exact failure/reference provenance; PR #199 additionally hardened malformed runtime inputs fail-closed.
- [x] #190 — Replay Lab/operator Memory Safety projection separates persisted records, deterministic interpretations and human decisions, preserves exact references/current-vs-stale status, and consumes only read/list dependencies.
- [ ] #191 — **active** adversarial contract freeze. E1, E2, E3 and E5 now have explicit runtime fail-closed validation; E4 retains the equivalent hardening from #199. The freeze adds cross-layer malformed-input, integrity, replay, terminal-recovery, cross-memory isolation and read-only authority coverage plus stakeholder Gherkin.

## Distribution / release closeout

- [x] Exact ZIP is checksum/commit-bound and tested through fresh install + paired repair on Windows 2022/2025.
- [x] `0.1.0-internal.6` preserved as prior runtime-readiness candidate.
- [x] `0.1.0-internal.7` through `0.1.0-internal.18` frozen after qualification/supersession and must never be reused.
- [ ] Qualify `0.1.0-internal.19` on the final #191 SHA through architecture, CI, Chromium, Windows launcher/first-run and both exact packaged-install jobs.
- [ ] Run manual UAT only after #191 merges and the exact `internal.19` candidate is green.
- [ ] Public release only after UAT and explicit `publicLaunchApproved=true` promotion.

## Enterprise measurement — #186

Primary KPIs:

- Goal → Useful Find Rate;
- Time to First Useful Find;
- Repeat Goal Usage.

Drivers/guardrails include mission completion/failure, install-to-first-Goal activation, Find usefulness/dismissal, notification delivery, altered-replay acceptance = 0, unauthorized memory admission = 0, credential/privacy leakage = 0, and exact package install/repair success.

Initial measurement remains local-first. Aggregate sharing requires a separate opt-in privacy design.

## Product experience after #191

After the Memory Safety v1 freeze, inspect live #186/#192 and current Goal contracts before implementation. The next product work must remain bounded and cross-surface:

1. one real Goal truth contract from the Kernel/local API;
2. wire that same truth into the web Control Center and browser extension;
3. verify desktop and mobile-width layouts plus reduced-motion/accessibility behavior;
4. prove automatic state transitions from real queued/investigating/verifying/completed/failed data;
5. only then advance to the next UI/product layer.

Do not redesign several surfaces at once. The web, extension and mobile-width experience must converge on the same persisted Kernel truth rather than duplicate or fabricated state.

## What not to do

Do not:

- turn Efesto into a generic scraper/admin dashboard;
- let Hermes/agents write durable memory, approve recovery, change prevention policy, or mutate through Replay Lab;
- reopen terminal memory IDs;
- infer hidden agent intent from repeated failures;
- collapse persisted facts, deterministic interpretations and human decisions into one trust label;
- silently rewrite stale safety records;
- add fake UI state, fake autonomous activity or unproven progress;
- build separate contradictory state machines for web, extension and mobile-width UI;
- reuse an immutable internal candidate identity after behavior changes.

## Next bounded sequence

1. Finish #191 only after its final `internal.19` architecture/CI/Chromium/Windows exact-package matrix is green.
2. Re-read live #186/#192 and current Goal/API/UI contracts.
3. Implement the smallest real Goal cross-surface slice, Kernel → web + extension, with desktop/mobile-width acceptance.
4. Evaluate that slice before adding the next UX/automation layer.
5. Keep value measurement local-first and wire it only when the bounded product contract requires it.
6. Freeze the next exact candidate → UAT → public promotion decision.

## Definition of “project star”

```text
Install exact qualified package
→ local Kernel proves readiness
→ user gives Goal from web or extension
→ one shared persisted Goal truth
→ bounded autonomous research
→ Evidence + provenance
→ Kernel authority gates
→ useful Finds
→ replay-safe controlled memory
→ deterministic quarantine + durable reviews
→ terminal disputes require governed new-candidate recovery
→ repeated persisted failures become read-only prevention guidance
→ operator sees current/stale safety state with epistemic source labels
→ Replay Lab remains incapable of mutating authority
→ desktop/mobile-width surfaces remain truthful and consistent
→ product measures user value while preserving privacy
```
