Feature: Hephaestus architecture and forensic authority boundaries
  Hephaestus must remain the provider-neutral authority for evidence, claims,
  provenance, validation, replay, and durable memory while agents remain external
  execution principals.

  Scenario: Provider-specific SDK is introduced into protected Kernel authority code
    Given a protected Hephaestus authority module
    When a change imports an OpenAI, Anthropic, Ollama, LangChain, Redis, Qdrant, E2B, Docker, or telemetry implementation directly
    Then the architecture boundary check fails
    And the provider implementation must remain behind an adapter boundary

  Scenario: An agent reports internal reasoning text
    Given an external agent run includes private reasoning or chain-of-thought text
    When Hephaestus records the run
    Then that private reasoning is not promoted into Evidence, a Claim, or durable Memory merely because it exists
    And only observable inputs, outputs, actions, tool results, validation decisions, and persisted provenance may establish forensic causality

  Scenario: An observable agent action produces evidence
    Given an authorized agent run returns a bounded public finding
    When the Kernel ingests the finding through its existing contracts
    Then the resulting Evidence preserves source and run provenance
    And any later Claim or Memory admission remains subject to Kernel-owned validation and admission gates

  Scenario: Event history is used for authority-sensitive state
    Given an authority-sensitive lifecycle transition occurs
    When Hephaestus persists its audit history
    Then the history is additive and replayable where the subsystem contract requires it
    And projections may be rebuilt without granting an agent authority to rewrite prior accepted history

  Scenario: A new use case has no business or security invariant
    Given a developer adds an internal helper or trivial implementation detail
    When tests are selected
    Then unit or contract tests may be used without creating ceremonial Gherkin
    But business invariants, authority boundaries, privacy behavior, replay behavior, and security failures require acceptance coverage
