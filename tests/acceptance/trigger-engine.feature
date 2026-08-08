Feature: Deterministic condition triggers without execution authority
  The Kernel may observe bounded facts and emit deduplicated trigger events
  but a trigger event never executes an external action by itself.

  Scenario: Price threshold becomes true
    Given an enabled trigger for a Goal and an exact Proposed Plan revision
    And the condition is price below 20
    When an observation reports price 19.50
    Then one trigger event is emitted
    And replaying the exact observation emits no duplicate durable event
    And no capability adapter is invoked by the Trigger Engine

  Scenario: Condition remains false
    Given an enabled price trigger with threshold 20
    When an observation reports price 21
    Then no trigger event is emitted

  Scenario: Trigger is disabled
    Given a disabled availability trigger
    When availability is observed
    Then no trigger event is emitted

  Scenario: Malformed trigger policy
    Given a deadline-near trigger with a non-positive window
    When the Kernel loads the trigger definition
    Then loading fails closed
