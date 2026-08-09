Feature: Automatic Mission lease enforcement
  As the Hephaestus Kernel
  I want authorization and runtime safety checked before lease issuance
  So that automatic work cannot begin outside the user's read-only authority

  Scenario: Eligible Mission receives one bounded lease
    Given a current Goal and revision-bound read-only authorization
    And the read-only Hermes runtime is certified
    And CapabilityRegistry and automatic policy allow web.search
    When Hermes requests the automatic Mission
    Then authorization is evaluated before the attempt counter changes
    And one lease is issued

  Scenario: Policy denial cannot burn attempts
    Given an automatic Mission is not authorized
    When Hermes requests the Mission
    Then no lease is issued
    And the attempt counter is unchanged
    And a truthful automaticBlock reason is persisted idempotently

  Scenario: Unverified runtime cannot execute
    Given Goal authority would otherwise allow public discovery
    But the Hermes read-only runtime has not been certified
    When automatic eligibility is evaluated
    Then the decision is denied with runtime_read_only_unverified
    And Hermes receives no lease

  Scenario: Kernel gate failure fails closed
    Given the trusted Kernel authorization gate is unavailable
    When an automatic claim is attempted
    Then no lease is created
    And persisted Mission state is unchanged
