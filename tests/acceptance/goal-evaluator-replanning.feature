Feature: Goal evaluation and immutable replanning
  Efesto evaluates outcomes against the exact Proposed Plan revision
  and never silently edits the plan that produced the result.

  Scenario: Goal is complete
    Given every plan task is completed
    And every declared completion condition is satisfied
    When the Kernel evaluates the Goal
    Then the status is completed
    And no new plan revision is requested

  Scenario: Goal must wait
    Given work is incomplete
    And progress depends on a future external condition
    When the Kernel evaluates the Goal
    Then the status is waiting
    And the next action is await_trigger

  Scenario: Goal must be replanned
    Given work failed or remains incomplete without a blocker
    When the Kernel evaluates the Goal
    Then the status is continue
    And the next action is new_plan_revision
    And replanning creates an append-only revision linked to the prior revision

  Scenario: Human review is required
    Given an explicit blocker exists
    When the Kernel evaluates the Goal
    Then the status is blocked
    And no automatic replanning or execution occurs
