Feature: G4 final automatic read-only autonomy freeze
  As an Efesto user
  I want one trusted Goal authorization to produce useful verified public-web work
  Without giving the agent side-effect or memory authority

  Scenario: Authorized Goal completes the safe value loop
    Given the user explicitly authorizes research for a current Goal revision
    And the receipt is trusted and read_only_continuation scoped
    And certified Hermes safe search-only discovery is available
    When Efesto continues automatically
    Then CapabilityRegistry authorizes web.search before the discovery lease
    And Hermes output is persisted only as searchCandidates
    And CapabilityRegistry authorizes web.read before Kernel source verification
    And only fetched public-page content may become Evidence
    And any promoted Find keeps Case, Evidence, Mission and source provenance

  Scenario: Authority change during verification fails closed
    Given a candidate page fetch is in progress
    When the Goal is paused, cancelled or revised before persistence
    Then the Kernel rechecks authority
    And stale fetched content is not admitted as Evidence or a Find

  Scenario: Restart preserves safety and progress
    Given authorized work is queued, verifying or covered by an unexpired lease
    When Efesto restarts
    Then queued work re-enters the normal claim gate
    And verifying work re-enters Kernel web.read verification
    And an unexpired investigating lease is not stolen
    And exact replay cannot duplicate Evidence or Finds

  Scenario: Read-only autonomy cannot escalate
    Given web.search and web.read may continue automatically
    Then purchases, logins, form submissions, messages, file mutation and payments require separate authority
    And agent output cannot admit durable memory
    And Replay Lab remains read-only over memory authority

  Scenario: Both product surfaces remain truthful
    Given the Mission persists investigating, verifying, forged, completed or failed state
    Then Control Center and extension consume Shared Goal Truth from the Kernel
    And work motion reflects only persisted active work
    And completed without forged is not presented as verified Evidence
