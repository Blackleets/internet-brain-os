Feature: Memory Safety v1 contract freeze
  Hephaestus must keep memory safety observable, replay-safe and fail-closed
  without allowing agents, projections or malformed runtime input to gain authority.

  Scenario: Malformed runtime input fails closed at every Memory Safety boundary
    Given Memory Safety receives malformed, null, scalar or structurally invalid runtime data
    When quarantine, recommendation persistence, recovery review, repeated-failure evaluation or Replay Lab projection validates that data
    Then the boundary rejects it with a controlled domain or input error
    And it must not rely on JavaScript coercion to invent identifiers
    And it must not expose a raw TypeError as its safety contract

  Scenario: Corrupt durable safety data never becomes current authorization
    Given a stored quarantine recommendation or recovery review has missing or invalid integrity data
    When its integrity is verified
    Then verification returns false rather than trusting or executing the record
    And no memory-authority transition is performed

  Scenario: Terminal memory cannot be reopened by recovery review
    Given a memory is rejected, superseded or revoked
    When a recovery review is approved by an authorized human or founder
    Then the original memory remains terminal
    And the approval must reference a distinct new candidate memory identity
    And an agent or automated reviewer cannot approve recovery

  Scenario: Repeated failures produce guidance rather than automatic policy
    Given repeated persisted failures cross the configured deterministic threshold
    When Hephaestus evaluates the failure pattern
    Then any prevention recommendation remains read-only
    And it cites exact persisted failure and reference identifiers
    And it does not infer hidden agent intent
    And it cannot change memory, capability, approval or policy authority

  Scenario: Replay Lab is an operator projection and never an authority writer
    Given quarantine records, recovery reviews and prevention recommendations exist for a memory
    When Replay Lab builds the Memory Safety view
    Then persisted records, deterministic projections and human decisions remain distinguishable
    And stale records are labelled historical rather than current authorization
    And records belonging to another memory are not projected into this memory
    And the query surface exposes read operations only
    And no memory transition, recovery approval, capability mutation or policy mutation command is exposed

  Scenario: Exact replay remains safe while altered replay fails closed
    Given a persisted Memory Safety record already exists for an exact normalized basis
    When the exact basis is replayed
    Then the operation is idempotent
    When the same identity is replayed with altered persisted facts
    Then Hephaestus rejects the altered replay
    And the previously stored forensic history remains unchanged
