Feature: Recover a historical Goal change block with a fresh user decision
  Scenario: The previous attempt cannot verify a revised Goal
    Given a mission is running and verifying with no live lease
    And the Kernel recorded authorization_revision_mismatch
    When the user opens its Forge view
    Then the view explains that the Goal changed
    And the view offers Buscar más without invoking research
    When the user explicitly confirms Buscar más
    Then the existing Kernel endpoint issues a receipt for the current Goal revision
    And the previous block and its candidates are retained in attempt history
    And previous Evidence and Finds are preserved

  Scenario: Other denials and active work are not offered this recovery
    Given a mission has a generic policy block or a live lease
    Then this recovery action is not offered
    And no authorization or stored mission state changes merely by rendering the view
