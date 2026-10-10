Feature: Honest time to useful value across research retries
  Scenario: Buscar más does not erase the user's prior wait
    Given an authorized Goal revision at 10:00 whose first mission failed
    And a new authorized mission for the same revision at 11:00
    And a Kernel-supported Find from that new mission
    When the user marks that Find useful at 11:05
    Then time to first useful Find is 65 minutes
    And the Useful Find Rate denominator contains one Goal revision
    And mission ordering does not change the result
    And the source records are unchanged

  Scenario: Feedback cannot precede its producing mission
    Given a Goal revision authorized at 10:00 and a retry at 11:00
    When feedback for the retry's Find claims a time of 10:30
    Then that feedback is excluded as an invalid timestamp
    And editing the Goal produces a separate measurement revision
