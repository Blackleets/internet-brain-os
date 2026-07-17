# Agent Continuation Contract

Before changing code in this repository:

1. Read `ARCHITECTURE.md`.
2. Inspect the target package, implementation, tests, and exports.
3. Confirm the current file SHA before sequential updates.
4. Make the smallest coherent change that advances the current priority.
5. Preserve backward compatibility unless a deliberate migration is documented.
6. Add or update tests for behavior changed.
7. Validate types, tests, and build when the repository provides those commands.
8. Update `ARCHITECTURE.md` when the architecture or priority queue changes.

## Non-Negotiable Invariants

- Hermes is the external discovery/tool/provider/execution layer.
- Hephaestus is the knowledge-forging kernel.
- Evidence and provenance must not be silently discarded.
- Memory lifecycle transitions must remain explicit.
- Research state transitions must remain explicit.
- Retries must be bounded and observable.
- New integrations should be adapters, not domain-layer provider coupling.
- Do not overwrite concurrent work based on stale file contents.

## Current Direction

Stabilize the foundation first. Then make the Hermes ↔ Hephaestus bridge production-grade. Then connect research outputs to evidence, claims, graph, and memory. Keep the future Nametrom model/distillation work behind provider/model adapters.
