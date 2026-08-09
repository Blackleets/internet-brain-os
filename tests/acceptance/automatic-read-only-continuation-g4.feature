Feature: Automatic read-only continuation stays inside explicit Goal authority
  Efesto may continue harmless public research after one meaningful user authorization
  but the Kernel must never infer that authority from an active Goal or agent intent alone.

  Scenario: Matching human authorization permits R0 continuation
    Given an active Goal at revision 3
    And a human-approved read_only_continuation receipt bound to that Goal revision
    And an available R0 capability whose consent policy is none or policy
    When the automatic read-only policy evaluates continuation
    Then the result is eligible without another prompt
    And the result references the persisted authorization receipt
    And no new capability or memory authority is granted

  Scenario: Goal presence alone is not authorization
    Given an active Goal
    And no persisted Goal execution authorization receipt
    When automatic continuation is evaluated
    Then the decision is denied as authorization_missing

  Scenario Outline: Terminal or paused Goal cannot continue automatically
    Given a Goal whose status is <status>
    And a previously approved read_only_continuation receipt
    When automatic continuation is evaluated
    Then the decision is denied as goal_not_active

    Examples:
      | status    |
      | paused    |
      | completed |
      | failed    |
      | cancelled |

  Scenario: A Goal edit invalidates previous automation authority
    Given an authorization receipt bound to Goal revision 3
    And the current Goal revision is 4
    When automatic continuation is evaluated
    Then the decision is denied as authorization_revision_mismatch

  Scenario Outline: Side-effect risk never inherits read-only authorization
    Given a valid Goal authorization receipt
    And a capability whose risk level is <risk>
    When automatic continuation is evaluated
    Then the decision is denied as capability_not_read_only

    Examples:
      | risk            |
      | r1_reversible   |
      | r2_external     |
      | r3_irreversible |

  Scenario: Always-consent capability needs a fresh user decision
    Given a valid Goal authorization receipt
    And an R0 capability whose consent policy is always
    When automatic continuation is evaluated
    Then the decision is denied as capability_requires_fresh_consent

  Scenario: Agent cannot authorize its own automatic continuation
    Given a receipt whose actor type is agent
    When automatic continuation is evaluated
    Then the decision is denied as authorization_actor_not_human

  Scenario: Malformed runtime input fails closed
    Given null, scalar, array, or structurally invalid policy input
    When automatic continuation is evaluated
    Then no raw runtime exception escapes
    And the decision is denied as invalid_input
