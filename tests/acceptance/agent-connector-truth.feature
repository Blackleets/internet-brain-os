Feature: Agent connector reflects Kernel mission facts
  Scenario: Missions waiting for Hermes remain visible
    Given Hermes has one queued and one waiting_for_agent mission
    And another mission completed and another failed
    When the Kernel projects agent presence
    Then two missions are waiting for the agent

  Scenario: Completion without SUPPORT is not a forge
    Given a completed mission has no supported verification result with an Evidence identifier
    When the Kernel projects its last mission
    Then its phase is completed_without_forge
    And the dashboard says terminada sin Evidence

  Scenario: A supported completed forge remains visible
    Given a completed forged mission has a persisted Kernel SUPPORT verdict and Evidence identifier
    When the Kernel projects its last mission
    Then its phase is forged

  Scenario: Browser clients cannot invent agent contact
    Given no agent process has contacted the Kernel
    When a dashboard origin posts an agent ping
    Then the Kernel refuses it
    And agent presence remains never
