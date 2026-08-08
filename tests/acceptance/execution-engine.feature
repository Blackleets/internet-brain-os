Feature: Controlled capability execution
  Efesto must execute only capabilities authorized by the exact Goal, plan revision, Registry state and approval policy.

  Scenario: Observation capability executes once
    Given an R0 capability is registered, healthy and requested by the current plan revision
    And the Goal allows that capability and its data scope
    When the Execution Engine receives a new idempotency key
    Then it persists an execution reservation before invoking the adapter
    And it records completion after the adapter returns

  Scenario: Exact replay is idempotent
    Given an execution already completed for an idempotency key
    When the exact same execution request is replayed
    Then the stored completion is returned
    And the external adapter is not called again

  Scenario: Altered replay is blocked
    Given an idempotency key was already used
    When the same key is reused with altered payload or authority fields
    Then execution is rejected as an idempotency conflict

  Scenario: External action requires exact approval
    Given an R2 capability is requested by the current plan revision
    When no matching approval receipt is supplied
    Then execution is rejected before the adapter is called

  Scenario: Lost external outcome fails safe
    Given an adapter was invoked after a durable reservation
    When the adapter throws and the external side effect cannot be proven absent
    Then the execution becomes in doubt
    And automatic retry with the same key is blocked

  Scenario: In-doubt execution requires reconciliation
    Given an execution is in doubt
    When a trusted reconciliation confirms the external outcome
    Then a terminal reconciliation record is appended
    And the adapter is not executed again
