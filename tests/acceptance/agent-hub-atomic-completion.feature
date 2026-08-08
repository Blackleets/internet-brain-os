Feature: Agent Hub completion is atomic, idempotent and recoverable
  Hermes may return bounded findings, but the Kernel must commit Evidence, Opportunity projection,
  and terminal mission state as one transaction so partial truth cannot survive a failed completion.

  Scenario: Complete one mission atomically
    Given Hermes holds a valid mission lease
    And the returned findings pass the public-result boundary
    When the Kernel completes the mission
    Then Evidence and in-scope Opportunities are written in the same transaction as the forged mission state
    And the lease is cleared only after the transaction succeeds

  Scenario: Roll back a failed projection
    Given Hermes holds a valid mission lease
    And an earlier finding can be projected
    And a later finding causes Opportunity projection to fail
    When the Kernel attempts completion
    Then no new Case is persisted
    And no new Evidence is persisted
    And no new Opportunity is persisted
    And the mission remains running under its existing lease

  Scenario: Retry after a lost completion response
    Given the Kernel committed a completed mission
    And the worker lost the HTTP response after that commit
    When the worker reads authenticated mission state
    Then it treats the persisted completed mission as success
    And it does not report a false failure

  Scenario: Replay a completed result
    Given a mission is already completed
    When the same completion request reaches the Kernel again
    Then the Kernel returns the completed mission idempotently
    And it does not create duplicate Evidence or Opportunities

  Scenario: Competing completion requests
    Given two completion requests race using the same valid lease
    When the store serializes their transactions
    Then only one request may create durable side effects
    And the other observes the already completed mission
    And the final Evidence count is not duplicated
