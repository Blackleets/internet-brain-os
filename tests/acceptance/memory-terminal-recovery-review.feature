Feature: Terminal memory recovery review
  Rejected, superseded and revoked memory remain terminal. Recovery can only create a review record that may authorize a distinct new candidate.

  Scenario Outline: Terminal memory may enter recovery review without reopening
    Given memory is in terminal state <state>
    And a human or founder reviews under an explicit policy version
    When a recovery review is recorded
    Then the terminal memory state is unchanged
    And the review is append-only and integrity-bound

    Examples:
      | state      |
      | rejected   |
      | superseded |
      | revoked    |

  Scenario: Recovery is approved
    Given a terminal memory recovery review requires founder approval
    When the founder approves recovery
    Then the review must identify a distinct new candidate memory id
    And the terminal memory id cannot be reused as the candidate
    And the review itself performs no memory-authority transition

  Scenario: Automated reviewer attempts to approve recovery
    Given a kernel or recovery actor is supplied as the decision reviewer
    When the recovery review is recorded
    Then the review fails closed
    And no automated actor gains terminal-memory restoration authority

  Scenario: Recovery request is replayed exactly
    Given a recovery requestId was already persisted
    When the exact normalized review is appended again
    Then the operation is idempotent
    And no duplicate review record is created

  Scenario: Recovery request is altered on replay
    Given a recovery requestId was already persisted
    When the same requestId carries a changed review payload
    Then persistence fails closed as altered replay

  Scenario: Governing policy changes after review
    Given a persisted recovery review
    When the current policy version or terminal record context differs
    Then the review is marked stale
    And it cannot be silently treated as current authorization

  Scenario: Durable recovery history is tampered
    Given a stored recovery review is modified outside the Kernel contract
    When the repository reconstructs history after restart
    Then integrity verification fails closed
