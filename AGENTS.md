# Agent Continuation Contract

Before changing code in this repository:

1. Read `PROJECT_STATE.md` and run `pnpm resume`.
2. Read `ARCHITECTURE.md`.
3. Inspect the target package, implementation, tests, and exports.
4. Confirm the current file SHA before sequential updates.
5. Make the smallest coherent change that advances the current priority.
6. Preserve backward compatibility unless a deliberate migration is documented.
7. Add or update tests for behavior changed.
8. Validate types, tests, and build when the repository provides those commands.
9. Update `PROJECT_STATE.md` and `ARCHITECTURE.md` when the completed baseline, blocker, recovery procedure, architecture, or priority queue changes.

## Non-Negotiable Invariants

- Hermes is the external discovery/tool/provider/execution layer.
- Hephaestus is the knowledge-forging kernel.
- Evidence and provenance must not be silently discarded.
- Memory lifecycle transitions must remain explicit.
- Research state transitions must remain explicit.
- Retries must be bounded and observable.
- New integrations should be adapters, not domain-layer provider coupling.
- Do not overwrite concurrent work based on stale file contents.

## Product UI Contract

Any change to `apps/dashboard`, `apps/extension`, or another end-user Efesto surface must apply the exported `skill:efesto-product-ui` contract from `packages/skills`.

- Start from the user's Goal or next decision, not from internal subsystem names.
- Every visible control must have a real action, disabled state, or explicit unavailable explanation. Decorative fake buttons are forbidden.
- A control that mutates Kernel state must call an existing authenticated Kernel contract and render success/failure truthfully.
- External or irreversible actions require explicit confirmation and policy/capability approval.
- Motion may only communicate observable state such as ready, queued, investigating, verifying, forged, failed, or active model streaming.
- Mobile and desktop are first-class surfaces. Preserve keyboard focus, touch targets, safe-area insets, reduced motion, and readable input sizing.
- Never invent progress, opportunities, Evidence, graph edges, mission state, model availability, or readiness.
- Prefer progressive disclosure: Goal/chat surface first; Missions, Finds, Evidence, Models, Agents, Automations, and Settings remain directly reachable but secondary.

## Current Direction

Stabilize the foundation first. Then make the Hermes ↔ Hephaestus bridge production-grade. Then connect research outputs to evidence, claims, graph, and memory. Keep the future Nametrom model/distillation work behind provider/model adapters.
