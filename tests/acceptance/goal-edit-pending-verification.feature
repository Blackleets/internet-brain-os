Feature: Preserve Goal authorization while the Kernel verifies sources
  Scenario: Edit attempted after candidates were submitted without a live lease
    Given a Goal at revision 1 has a running mission awaiting Kernel source verification
    And the Hermes lease has been released
    When the user confirms a changed Goal revision
    Then the Kernel returns GOAL_MISSION_RUNNING with status 409
    And the Goal, mission, Evidence and Finds remain unchanged
    When the Kernel finishes verification under revision 1
    Then the user can confirm the edit as revision 2

  Scenario: Pending verification appears while the edit dialog is open
    Given the user has typed a revised Goal in the existing editor
    When the dashboard observes the Kernel verifying the Goal's sources
    Then the editor explains why saving must wait
    And the typed text is retained without a save request
    When the dashboard observes the finished mission
    Then saving becomes available with the typed text intact

  Scenario: A historical authorization mismatch remains untrusted
    Given an old mission was blocked by a Goal revision mismatch
    Then this correction creates no Evidence, Find or new authorization for that mission
    And the already recorded block does not freeze further Goal editing
