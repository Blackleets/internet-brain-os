Feature: Automatic read-only Mission claim eligibility
  As the Hephaestus Kernel
  I want automatic Mission claims to require current Goal authority and a real R0 capability
  So that agents cannot turn Goal presence or token possession into autonomous execution authority

  Scenario: Trusted current Goal may continue public discovery
    Given an active Goal with a current revision-bound read-only continuation receipt
    And the Goal authorizes public web research
    When automatic Mission claim eligibility is evaluated
    Then the Kernel authorizes the real web.search capability
    And the automatic read-only policy allows continuation
    And no lease or side effect is created by the eligibility decision itself

  Scenario: Stale authorization cannot continue automatically
    Given an active Goal whose revision changed after authorization
    When automatic Mission claim eligibility is evaluated
    Then the decision is denied
    And no Mission lease is granted

  Scenario: Agent cannot self-authorize automatic work
    Given a Mission without a trusted interactive authorization receipt
    When automatic Mission claim eligibility is evaluated
    Then the decision is denied
    And token possession alone does not create user authority

  Scenario: Pending verification blocks another discovery pass
    Given a Mission already has public search candidates awaiting verification
    When automatic Mission claim eligibility is evaluated
    Then the decision is denied with verification pending
    And the agent does not start a second discovery pass

  Scenario: Capability constraints remain fail closed
    Given a UniversalGoal that does not allow web.search
    When automatic Mission claim eligibility is evaluated
    Then CapabilityRegistry denies web.search
    And the automatic Mission remains ineligible
