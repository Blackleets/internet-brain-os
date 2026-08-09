Feature: Automatic Mission restart recovery
  As an Efesto user
  I want authorized work to recover from a launcher or machine restart
  Without duplicate side effects or stolen leases

  Scenario: Queued Mission resumes after restart
    Given an authorized Mission is persisted as queued
    When one-click restarts
    Then recovery reads Missions through the authenticated Kernel API
    And the queued Mission re-enters the existing automatic claim path

  Scenario: Pending verification resumes after restart
    Given a Mission is persisted in verifying with search candidates
    When one-click restarts
    Then Kernel candidate verification resumes
    And exact verification replay cannot duplicate Evidence or Finds

  Scenario: Active lease is not stolen
    Given a Mission is still investigating with an unexpired lease
    When recovery inspects it
    Then recovery waits until the lease expires
    And only then re-enters the normal claim path

  Scenario: Hermes becomes available after restart
    Given a Mission was waiting_for_agent
    And the trusted Hermes adapter is now ready
    When the Kernel lists Missions during reconciliation
    Then the Mission becomes queued without changing its authorization receipt
