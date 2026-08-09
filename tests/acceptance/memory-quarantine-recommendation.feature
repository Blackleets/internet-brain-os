Feature: Deterministic memory quarantine recommendations
  The Hephaestus Kernel may recommend isolation from persisted risk references,
  but recommendations never become memory-authority transitions by themselves.

  Scenario: Persisted risk references recommend quarantine
    Given an admitted memory with a valid lifecycle revision
    And persisted references include an unresolved contradiction and invalid Evidence
    When the Kernel evaluates quarantine signals
    Then it returns a deterministic pending quarantine recommendation
    And the recommendation cites the exact persisted reference identifiers
    And no memory-authority transition is executed by the evaluator

  Scenario: Equivalent reference ordering replays deterministically
    Given the same memory identity, lifecycle revision and evaluator version
    And the same persisted risk references are supplied in a different order with duplicates
    When the Kernel evaluates quarantine signals again
    Then the normalized signals are identical
    And the recommendation identifier is identical

  Scenario: No persisted risk signal exists
    Given a non-terminal memory with no active persisted quarantine references
    When the Kernel evaluates quarantine signals
    Then the decision is no action
    And no quarantine recommendation is emitted

  Scenario: Memory is already quarantined
    Given a quarantined memory still has an active persisted risk reference
    When the Kernel evaluates quarantine signals
    Then it may recommend retaining quarantine
    But it does not create another lifecycle transition

  Scenario Outline: Terminal memory never re-enters the normal quarantine graph
    Given a memory is in terminal state <state>
    And persisted risk references still exist
    When the Kernel evaluates quarantine signals
    Then the decision is terminal no action
    And no normal quarantine recommendation is emitted
    And any dispute must use the separate recovery-review path

    Examples:
      | state      |
      | rejected   |
      | superseded |
      | revoked    |

  Scenario: An agent or model reports a low-confidence judgment
    Given an agent or model emits an unsupported judgment about memory quality
    And there is no corresponding persisted contradiction, Evidence, provenance, integrity, admission, policy or supersession reference
    When the Kernel evaluates quarantine signals
    Then the judgment alone cannot create a trusted quarantine signal
    And the decision remains no action

  Scenario: A persisted reference identifier is malformed
    Given a quarantine input contains an empty persisted reference identifier
    When the Kernel evaluates quarantine signals
    Then evaluation fails closed
    And no recommendation is emitted
