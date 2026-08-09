# Efesto Architecture Guardrails

Status: active engineering policy.

This policy extracts the useful parts of Clean Architecture, SOLID, DDD, BDD, and event-sourced auditability without replacing Efesto's existing architecture or turning Hephaestus into a generic agent framework.

## Product boundary

Efesto remains a local-first intelligence and opportunity product built around the Hermes ↔ Hephaestus separation:

- Hermes and other agents discover, call tools, interact with providers, and execute external work.
- Hephaestus owns evidence, claims, entities, provenance, validation, contradiction handling, replay safety, and durable memory authority.
- An agent is an external execution principal or source of a run. It is not the aggregate root of the Kernel.
- The Kernel must remain usable with different agents, models, storage implementations, and user surfaces.

## Dependency rule

Clean Architecture is enforced as a dependency rule, not as a mandatory folder rewrite.

Protected authority modules under `packages/kernel/src` must not depend directly on provider SDKs or concrete external infrastructure. Provider-specific implementations belong behind stable contracts or adapters. Existing vertical domain modules such as `evidence`, `claim`, `memory`, and `goal` remain valid; a big-bang migration to `domain/application/adapters/infrastructure` folders is explicitly rejected.

The executable check is:

```text
pnpm architecture:check
```

CI runs this check before typechecking and tests.

## Ports and adapters

Create an abstraction when a real replaceable boundary exists: model providers, agent runtimes, public-web discovery, persistence engines, notification delivery, sandbox execution, or similar external systems.

Do not create speculative interfaces for every class. A port must protect a domain or application decision from an external implementation detail.

The existing provider-neutral `LLMAdapter` contract is the model to follow. Concrete implementations may be migrated outward incrementally when doing so preserves public contracts and has test coverage; do not perform broad moves merely to satisfy a directory diagram.

## Forensic event policy

Efesto should preserve additive history where replay, authority, security, or provenance require it. Event sourcing is selective, not universal.

Good forensic events describe observable facts and Kernel decisions, for example:

- run accepted or rejected;
- source discovered;
- evidence recorded;
- claim proposed;
- validation performed;
- contradiction detected;
- admission accepted or rejected;
- memory lifecycle transition;
- replay attempted, accepted, or blocked;
- mission phase transition;
- capability or approval decision.

Do not model private chain-of-thought as a trusted domain event. Names such as `AgentThoughtGenerated` or a `ChainOfThought` aggregate are not part of the authority model. If an external system sends reasoning text, it remains untrusted run material unless an existing Kernel contract explicitly transforms an observable statement into Evidence or a Claim and all normal gates apply.

Forensic causality must be based on persisted relationships, not inferred hidden intent.

## BDD policy

Gherkin is required where behavior expresses a business, security, privacy, authority, replay, lifecycle, or failure invariant. It is not required one-file-per-class or one-file-per-helper.

Use the lightest test that proves the contract:

- unit tests for local deterministic behavior;
- contract tests for stable boundaries;
- property or negative tests for invariants and malformed input;
- integration tests for wiring and persistence;
- Gherkin acceptance tests for behavior a product/security stakeholder should be able to read.

## Infrastructure policy

Do not add Redis, Qdrant, E2B, Docker, Kafka, OpenTelemetry, or another platform simply because it appears in an enterprise reference architecture. Add infrastructure only when a measured product, reliability, security, scale, or operability requirement justifies the dependency.

Local-first, loopback-only boundaries and simple persistence are product advantages until evidence shows otherwise.

## Change protocol

For architecture-sensitive changes:

1. Inspect the current implementation, tests, exports, and file SHA.
2. Preserve public contracts unless a migration is intentional and documented.
3. Prefer additive, typed, reversible changes over broad rewrites.
4. Add a failing test for the invariant before or with the implementation where practical.
5. Run `pnpm architecture:check`, `pnpm typecheck`, `pnpm test`, and the relevant build/acceptance checks.
6. Never weaken evidence, provenance, replay, privacy, approval, or memory-admission authority to make an adapter easier to integrate.

## Commercial quality lens

These guardrails do not guarantee a company valuation. They are intended to make Efesto easier to trust, extend, review, secure, and operate—qualities required for a serious product. Product value still depends on user activation, retained usage, successful goals/finds, reliability, distribution, and a sustainable business model.
