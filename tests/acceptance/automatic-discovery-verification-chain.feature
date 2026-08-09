Feature: Automatic discovery continues into Kernel verification
  As an Efesto user
  I want an authorized Goal to continue from safe discovery into source verification
  Without a second harmless-read click or a new authority boundary

  Scenario: Hermes candidates continue automatically into web.read
    Given a trusted Goal receipt allows read-only continuation
    And certified Hermes discovery returns search candidates
    When the worker reports verifying
    Then one-click requests verify_candidates through the existing authenticated Mission results route
    And AgentMissionExecutor delegates verification to the Kernel-owned verifier
    And only Kernel web.read content may become Evidence

  Scenario: Verification cannot escape loopback or token authentication
    Given one-click requests candidate verification
    Then the verification client accepts only loopback HTTP
    And it sends the existing Kernel token
    And a mismatched or failed Kernel response is not treated as success

  Scenario: Verification remains a Kernel decision
    Given Hermes returned candidates
    When verify_candidates is requested
    Then Hermes does not provide the verification page content
    And the existing results route does not bypass CapabilityRegistry or automatic-read-only policy
