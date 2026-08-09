Feature: Replay Lab memory safety projection
  Operators need to inspect quarantine, recovery, and prevention state without giving Replay Lab memory authority.

  Scenario: Current quarantine recommendation is displayed
    Given a persisted quarantine recommendation matches the current lifecycle, evaluator, and signal basis
    When Replay Lab projects memory safety
    Then the record is labeled current
    And its exact persisted signal references are visible
    And its basis is persisted record
    And its authority is read only

  Scenario: Historical recovery review is stale
    Given a human or founder recovery review was persisted
    And the terminal memory context or governing policy has changed
    When Replay Lab projects memory safety
    Then the review is labeled stale
    And the recorded reviewer, terminal state, policy version, and replacement candidate remain visible
    And the terminal memory is not reopened

  Scenario: Repeated-failure prevention guidance is displayed
    Given a deterministic prevention recommendation cites persisted failure and reference ids
    When Replay Lab projects memory safety
    Then the basis is deterministic projection
    And the exact failure and persisted reference ids remain visible
    And the view does not infer hidden agent intent

  Scenario: Safety projection mixes distinct epistemic sources
    Given quarantine is a Kernel persisted record
    And recovery is a human decision
    And prevention is a deterministic interpretation
    When Replay Lab renders the combined memory safety view
    Then each item retains its own basis label
    And none is silently promoted into another source class

  Scenario: A stale safety item exists
    Given one or more safety items no longer match current governing context
    When Replay Lab projects the memory view
    Then a warning says stale records must not be treated as current authorization

  Scenario: Operator reads memory safety
    Given Replay Lab receives read-only list dependencies
    When an operator queries one memory id
    Then Replay Lab may return the safety projection
    But the query surface exposes no memory transition, recovery approval, policy mutation, or capability mutation command
