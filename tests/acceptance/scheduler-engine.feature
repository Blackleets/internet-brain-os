Feature: Scheduler due-run claims
  The scheduler may decide that work is due, but it must not bypass Efesto's execution authority.

  Scenario: One-shot schedule claims once
    Given an enabled one-shot schedule whose start time has passed
    When the Scheduler checks due work
    Then exactly one run claim is persisted for that due slot
    And a repeated check does not create another claim

  Scenario: Recurring schedules use deterministic slots
    Given an interval, daily or weekly schedule
    When the Scheduler checks at a known UTC instant
    Then the claim uses the deterministic latest due slot
    And the due-slot idempotency key prevents duplicates

  Scenario: Disabled or future schedule does not run
    Given a schedule is disabled or has not started
    When the Scheduler checks due work
    Then no run claim is produced

  Scenario: Scheduler cannot execute an action
    Given a scheduled run is claimed
    Then the claim only binds a plan revision and due time
    And actual capability execution must still pass the Execution Engine gates
