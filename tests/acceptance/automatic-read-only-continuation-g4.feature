Feature: Automatic read-only continuation stays inside explicit Goal authority
  Efesto may continue harmless public research after one meaningful user authorization
  but the Kernel must never infer that authority from an active Goal, token possession, or agent intent alone.

  Scenario: Matching trusted interactive-user authorization permits R0 continuation
    Given an active Goal at revision 3
    And an interactive-user approved read_only_continuation receipt bound to that Goal revision
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

  Scenario Outline: Automated authority cannot approve its own continuation
    Given a receipt whose actor type is <actor>
    When automatic continuation is evaluated
    Then the decision is denied as authorization_actor_not_user

    Examples:
      | actor  |
      | agent  |
      | system |

  Scenario: Malformed runtime input fails closed
    Given null, scalar, array, or structurally invalid policy input
    When automatic continuation is evaluated
    Then no raw runtime exception escapes
    And the decision is denied as invalid_input

  Scenario: Trusted Control Center confirmation persists a revision-bound receipt
    Given an active Goal without automatic authorization
    And an authenticated Mission request from an allowed Control Center origin
    When the user explicitly confirms the Mission
    Then the Mission stores an efesto.goal-execution-authorization.v1 receipt
    And the receipt actor type is interactive_user
    And the receipt is bound to the exact Goal revision

  Scenario: Token possession alone does not become interactive-user authority
    Given an authenticated local client with the Kernel token but no trusted browser origin
    When it sends confirmed true for a Mission
    Then the Mission may remain compatible with the manual flow
    But no automatic authorization receipt is minted

  Scenario: Client-supplied authorization cannot forge user authority
    Given a client payload containing an agent-authored authorization object
    When Mission confirmation reaches the trusted boundary
    Then the client authorization object is ignored
    And only trusted server context may mint the persisted authorization receipt

  Scenario: A live pre-G4 Mission can be authorized without duplication
    Given a live Mission without an authorization receipt
    When the user explicitly reconfirms it from a trusted interactive surface
    Then the existing Mission receives a new revision-bound receipt
    And no duplicate Mission is created

  Scenario: Idempotent replay preserves an existing receipt
    Given a live Mission that already has a trusted authorization receipt
    When the same trusted confirmation is repeated
    Then the same Mission and authorization receipt are returned

  Scenario: Terminal retry receives a fresh receipt
    Given a terminal Mission with an older authorization receipt
    When the user explicitly retries from a trusted interactive surface
    Then the Mission restarts under a fresh authorization receipt
    And lease reconciliation preserves that authorization provenance
