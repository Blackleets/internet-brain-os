Feature: Local-first product value scorecard
  Efesto must measure whether Goals create useful Finds without exporting private behavior.

  Scenario: A confirmed Goal produces a useful Find
    Given a Goal has a trusted read-only authorization receipt
    And Kernel-verified Evidence from that Goal produced a Find
    When the user marks that Find useful or saved
    Then Goal Useful Find Rate includes the Goal as useful
    And Time to First Useful Find starts at the trusted authorization decision
    And the scorecard remains local-only

  Scenario: A Goal produces Finds but no useful feedback yet
    Given a confirmed Goal produced one or more Goal-linked Finds
    And none has been marked useful or saved
    When the product scorecard is read
    Then Goal Useful Find Rate is measurably zero for that Goal population
    But Time to First Useful Find is reported as not measurable
    And Efesto does not invent a duration

  Scenario: Manual browsing evidence is not counted as autonomous Goal value
    Given a Find has no Evidence provenance linking it to an Agent Mission
    When the user marks that Find saved
    Then the event does not increase Goal Useful Find Rate
    And the scorecard records that feedback as outside Goal-linked measurement coverage

  Scenario: One private installation repeats Goal usage
    Given the local Kernel has initialized one local-installation measurement cohort
    And that installation has authorized two distinct Goals
    When Repeat Goal Usage is read
    Then it is measured as one repeated installation out of one activated installation
    And no global user or device identifier is created

  Scenario: Repeat Goal Usage has no activated denominator yet
    Given the local Kernel has initialized one local-installation measurement cohort
    And that installation has not authorized a Goal
    When Repeat Goal Usage is read
    Then its status is not measurable
    But installation-to-first-Goal activation is measurably zero for the one local installation

  Scenario: No central telemetry is introduced
    Given the scorecard reads the existing local knowledge store
    When it is exposed through the authenticated preferences read boundary
    Then no new outbound telemetry endpoint exists
    And no new write authority is created
