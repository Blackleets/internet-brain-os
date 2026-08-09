Feature: G4 automatic read-only work stays truthful across surfaces
  As an Efesto user
  I want web and extension to describe the same persisted work
  Without repeated prompts during harmless autonomous reads

  Scenario: One explicit authorization starts read-only continuation
    Given an idle Goal is researchable
    When the user explicitly authorizes Hermes research once
    Then the Kernel mints the trusted read-only receipt
    And subsequent web.search and web.read continuation requires no extra UI prompt
    And side-effect capabilities remain separately approval-gated

  Scenario: Verifying means the same thing everywhere
    Given the Mission has persisted search candidates awaiting Kernel web.read
    Then Shared Goal Truth projects workState verifying
    And the extension presents Efesto is verifying findings
    And the Control Center derives its Forge state from the same Shared Goal Truth workState

  Scenario: Forged requires persisted verification output
    Given Kernel web.read created Evidence from fetched source content
    When the Mission becomes forged
    Then both surfaces consume the persisted forged workState
    And a completed Mission without forged remains visually calm

  Scenario: Automatic continuation never becomes memory authority
    Given web.search and web.read are authorized automatically
    Then neither UI state nor agent output can admit durable memory
    And Replay Lab remains read-only over memory authority
