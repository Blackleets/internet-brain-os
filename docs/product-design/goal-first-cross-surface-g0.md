# Goal-first cross-surface G0

Status: design contract for Phase G0 / issue #192. This document defines the next product experience before implementation. It does not create a new authority path and does not claim capabilities that the current runtime does not have.

## Product brief

### Target

Efesto is a local-first autonomous opportunity system. A person should be able to state a Goal once, confirm the permitted work once, and then see the same persisted Goal and truthful execution state wherever Efesto exposes the product experience.

### Primary user outcome

```text
State a Goal
→ understand what Efesto is allowed to do
→ confirm
→ Efesto works automatically inside that policy
→ see real progress
→ receive useful Finds with Evidence
→ decide the next action
```

The primary success condition is not “more dashboard features.” It is faster time from intent to a useful, evidence-backed Find while preserving trust and explicit authority boundaries.

### Business outcomes

This experience should improve:

- installation → first confirmed Goal activation;
- Goal → Useful Find Rate;
- Time to First Useful Find;
- repeat Goal usage;
- comprehension of automatic work versus approval-required work.

No central telemetry is introduced by this design contract. Initial measurement remains local-first per #186.

## Grounding in the existing product

This contract is based on current repository behavior, not a speculative redesign:

- `packages/kernel/src/goal/goal-contract.ts` defines `UniversalGoal` contract v2, Goal lifecycle status, autonomy level, approval, notification, memory and termination policy.
- `apps/local-kernel/goals.mjs` currently persists the smaller radar-oriented Goal shape used by the product: title, categories, keywords, location, priority, status and createdAt.
- `apps/local-kernel/server.mjs` exposes authenticated `/api/goals`, `/api/agent-missions` and `/api/goals/:id/missions` routes from the local Kernel boundary.
- `apps/dashboard/components/efesto-product-shell.tsx` already uses a Goal-first composer, prepares without writing, requires explicit confirmation, then persists a Goal and creates a mission.
- `apps/dashboard/e2e/overview.spec.ts` proves the desktop Goal-first journey, explicit confirmation, truthful offline state, and a 390×844 mobile-width layout without horizontal overflow.
- `apps/extension/src/popup.html` and `popup.js` expose Goals, Living Forge, Missions and Finds, but currently use a second Goal presentation and a separate “Research” confirmation interaction.
- `apps/web/landing` is the public marketing surface. It is not a trusted runtime client and must not become a second source of Goal or Kernel state.
- existing Efesto product tokens live in `apps/dashboard/app/efesto-product.css` and already establish the dark forge visual language.

## Architectural decision: one Goal truth, multiple projections

### Canonical domain target

`UniversalGoal` v2 is the long-term canonical Goal domain contract.

The current radar Goal stored by `apps/local-kernel/goals.mjs` is treated as a compatibility representation while migration is performed incrementally. G0 does **not** rewrite existing Goal storage or break the existing `/api/goals` contract.

The next engineering slice must introduce an additive, read-oriented Goal surface projection instead of making dashboard and extension interpret raw storage independently.

Proposed next-slice boundary name:

```text
GoalSurfaceSnapshot v1
```

Minimum presentation fields should be derived from persisted Kernel truth:

```text
goalId
goalRevision or compatibility revision
title
goalStatus
autonomyLevel / compatibility autonomy
approval policy summary
mission id, status and execution phase when present
updatedAt
latest Find count when available
sourceOfTruth = kernel
```

The projection is not an authority object. It must not expose capability grants, approvals or memory transitions that the underlying Goal/policy did not authorize.

## State model: do not collapse Goal and Mission state

The UI currently needs two related but different state families.

### Goal lifecycle

Canonical Goal lifecycle language follows the domain contract:

- `active` — the Goal may produce authorized work;
- `paused` — no new automatic work should begin;
- `completed` — the Goal has met its terminal success condition;
- `failed` — the Goal cannot continue under the recorded conditions;
- `cancelled` — the user terminated the Goal.

### Mission execution

Mission/work language remains observational and may include:

- queued / waiting;
- investigating;
- verifying;
- forged / completed;
- failed.

A running Mission does not silently rewrite Goal lifecycle, and a Goal marked active does not mean a Mission is currently running.

### Client-only states

Two states may exist only in the active UI surface and must never be presented as persisted Kernel truth:

- `draft` — text being composed locally;
- `prepared` — plan shown for confirmation, still not executed.

If another surface opens while a draft/prepared Goal exists on one client, it must not invent that draft as persisted state.

## Automatic-work authority rule

The user experience should require one meaningful confirmation for the Goal policy, not repeated confirmations for every harmless read-only step.

After a Goal is persisted and confirmed:

- read-only public research explicitly allowed by the Goal/capability policy may execute automatically;
- scheduler/trigger execution may continue automatically only while the Goal is active and the configured policy allows it;
- the UI may automatically follow real Mission state and refresh Finds without another confirmation;
- purchase, login, form submission, outreach, download, destructive actions or any other side effect remains separately capability/risk/approval gated;
- memory admission remains Kernel-owned and is never implied by Goal confirmation;
- paused, completed, failed or cancelled Goals must not spawn new work outside their allowed transition rules.

“Automatic” therefore means **automatic inside previously authorized boundaries**, not unrestricted agent authority.

## Cross-surface information architecture

The same hierarchy applies on desktop, mobile-width and extension:

```text
1. Goal — what the user wants
2. Work — what Efesto is actually doing now
3. Finds — useful outcomes from that work
4. Action — what the user may choose next
5. Evidence / Replay / Memory Safety — progressive disclosure for trust
```

Do not lead with infrastructure, models, logs or metrics on the primary Home surface.

### Full Control Center — desktop

Primary frame:

- one dominant Goal composer/current Goal;
- Living Forge / brain as truthful work-state visualization;
- current Mission sentence + compact stage trail;
- latest high-value Finds, not a generic card inventory;
- Evidence and advanced system areas remain reachable but secondary.

The existing 270px desktop navigation may remain unless implementation evidence shows it blocks activation.

### Full Control Center — mobile-width

The responsive Control Center is the mobile product target for this phase.

- use the existing drawer model;
- one-column Goal hierarchy;
- composer stays inside safe viewport and safe-area insets;
- current Goal and work state appear before secondary navigation;
- Finds become a vertical decision list;
- no horizontal overflow at the existing 390×844 acceptance size;
- reduced-motion mode must remain usable.

Important: current loopback security means this acceptance proves a responsive client connected to a Kernel available on that device/runtime context. G0 does **not** claim that an arbitrary phone can remotely control the private Kernel running on a PC. Secure cross-device transport requires its own threat model and bounded slice.

### Browser extension

The extension is a compact companion, not a miniature dashboard.

The primary extension hierarchy should become:

```text
Current Goal / New Goal
→ current truthful Forge state
→ latest Mission progress
→ top new Finds
→ current-page radar tools
```

Rules:

- it consumes the same Goal surface projection as the Control Center;
- it must not create its own Goal status vocabulary;
- it may retain local draft text, but persisted Goal state comes only from the Kernel;
- automatic read-only Goal work should not require a second redundant “Research” authorization after the Goal policy has already granted it;
- current-page capture/radar remains a separate user action because it represents a page-context workflow, not the Goal lifecycle itself.

### Public landing

`apps/web/landing` remains acquisition/education only.

It may explain Goals and link to install/open Efesto, but it must not:

- receive Kernel tokens;
- display private persisted Goals;
- fabricate live work state;
- become a hidden cloud authority path.

## State language for the Living Forge

Motion and copy must come from observable state.

| Observable state | User language | Motion rule |
| --- | --- | --- |
| disconnected | Local Kernel unavailable | no active-work motion |
| ready | The forge is ready | quiet ambient only |
| queued | Goal accepted · preparing work | bounded warm-up |
| investigating | Efesto is researching | active forge/data movement |
| verifying | Efesto is verifying findings | controlled verification motion |
| forged/completed | Results forged | short completion response, then rest |
| failed | Research needs attention | active-work motion stops |
| paused | Goal paused | no active-work motion |

Never animate “thinking” merely because a timer is running. Chat/model thinking remains a separate observable state from Goal/Mission execution.

## Design system constraints

Preserve the existing Efesto visual identity rather than starting a new brand:

- base background `#0b0b0c`;
- primary surfaces `#121214` / `#18181b`;
- forge accent `#e87732` and highlight `#ff9a55`;
- success `#7fb069`;
- failure `#e66b65`;
- violet `#9a79ff` reserved for model/secondary intelligence context rather than Goal authority;
- readable light text `#f4f1eb`;
- visible `:focus-visible` treatment;
- Inter/system UI typography;
- rounded surfaces are allowed, but avoid card-inside-card dashboard density.

The pixel smith / forge / brain identity is functional state language, not decorative proof of work.

## Three visual directions

### Direction A — Forge Focus — selected

**Hierarchy:** Goal and Living Forge dominate the first viewport. Current Mission becomes one concise line/stage rail below the forge; latest Finds appear only after the Goal/work area.

**Why:** fastest comprehension for a non-technical user; best match to “tell Efesto what you want and let it work”; preserves the current Goal-first shell and pixel-forge identity with the least disruptive migration.

**Desktop:** wide centered Goal/work column with navigation secondary.

**Mobile-width:** current Goal → forge state → progress → Finds in one vertical sequence.

**Extension:** compact current Goal plus Forge state, with a small new-Goal affordance.

### Direction B — Mission Thread

**Hierarchy:** Goal at top, followed by a chronological thread of persisted work events and Finds.

**Strength:** strongest operational transparency.

**Tradeoff:** makes Efesto feel closer to an activity monitor and can push the user’s actual outcome too far down the page.

### Direction C — Opportunity Radar

**Hierarchy:** Goal header plus Finds-first radar/decision queue; work state is secondary.

**Strength:** fastest for users returning only to inspect opportunities.

**Tradeoff:** weaker onboarding and easier to misread as a generic deals/jobs scraper instead of an autonomous evidence-first system.

### Decision

**Direction A — Forge Focus** is the G0 baseline for implementation.

Direction B remains the conceptual model for Mission/Replay detail. Direction C remains the conceptual model for the dedicated Finds workspace. They are not competing Home implementations.

## Accessibility and responsive contract

Implementation must preserve or improve:

- keyboard-operable Goal creation/confirmation;
- visible focus states;
- meaningful `aria-live` only for consequential status updates, not continuous noise;
- no status communicated by color alone;
- minimum practical touch target around 44px for primary mobile controls;
- 390px viewport with no horizontal overflow;
- content readable at browser zoom and text scaling;
- `prefers-reduced-motion` support with no continuous decorative animation required to understand state;
- failed/offline state understandable with motion disabled.

## Truth and security rules

1. Kernel is the only source of persisted Goal truth.
2. Dashboard and extension may keep drafts, not shadow Goal databases.
3. A client may render only states derivable from persisted/streaming Kernel data.
4. Landing is never a runtime authority surface.
5. Goal confirmation does not grant external side effects or memory authority.
6. A Mission phase cannot be promoted to a Goal lifecycle transition without the proper Kernel contract.
7. A visual animation cannot be used as evidence that work happened.
8. Mobile responsive behavior does not imply remote PC Kernel access.

## G0 acceptance matrix

G0 is complete when the repository contract makes the following implementation path unambiguous:

- one canonical Goal domain target (`UniversalGoal` v2);
- current radar Goal explicitly treated as compatibility representation;
- one future read projection for cross-surface presentation;
- distinct Goal lifecycle / Mission execution / client-only draft states;
- single-confirmation automatic read-only work policy;
- same information hierarchy for dashboard and extension;
- responsive 390×844 and reduced-motion requirements;
- landing separated from private runtime state;
- exactly three visual directions documented and Forge Focus selected;
- next bounded engineering slice is additive and does not redesign multiple surfaces at once.

## Next bounded slice after G0

**G1 — Shared Goal Truth v1**

Implement only the Kernel/local-api read projection needed to represent persisted Goal + current Mission truth consistently. Add contract/unit/Gherkin coverage. Do not redesign dashboard or extension in G1.

After G1 is green and merged:

- G2 consumes it in the responsive Control Center and proves desktop + 390×844 behavior;
- G3 consumes the same projection in the extension and removes duplicated Goal-status interpretation;
- G4 evaluates automatic execution/refresh parity across both clients and only then considers recurring/mobile-device transport work.

This order intentionally prevents a large cross-surface rewrite.