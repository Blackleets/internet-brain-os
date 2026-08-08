Feature: Approval and risk gate
  Efesto must never confuse risk assessment with permission to execute.

  Scenario: Observation-only capability can remain approval-free
    Given a healthy R0 observation capability allowed by the Goal
    And the Goal approval policy is none
    When Efesto assesses the Proposed Plan
    Then the highest risk is R0
    And explicit approval is not required

  Scenario: External action requires explicit approval
    Given a healthy R2 external capability allowed by the Goal
    When Efesto assesses the Proposed Plan
    Then explicit approval is required
    And no external action is executed by the assessment

  Scenario: Irreversible action cannot downgrade its approval requirement
    Given a registered R3 irreversible capability
    When a Goal or agent requests the capability
    Then the approval requirement remains explicit

  Scenario: Approval binds an exact immutable plan revision
    Given a Proposed Plan revision requests a known set of capabilities
    When the user approves that exact revision and capability set
    Then Efesto records an append-only approval receipt
    And replaying the exact same decision is idempotent

  Scenario: Stale approval fails closed
    Given a Proposed Plan has a newer revision
    When an approval references an older revision id
    Then the approval is rejected

  Scenario: Approval cannot smuggle additional or missing capabilities
    Given a Proposed Plan requests one capability
    When an approval names a different capability set
    Then the approval is rejected before any execution authority exists
