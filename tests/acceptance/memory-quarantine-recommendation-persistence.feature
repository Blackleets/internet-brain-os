Feature: Durable quarantine recommendation records
  Quarantine recommendations are append-only safety records and never memory-authority transitions.

  Scenario: A deterministic recommendation is persisted once
    Given the Kernel produced a pending quarantine recommendation from persisted risk references
    When the recommendation repository appends it
    Then the repository stores its normalized basis and integrity digest
    And the recommendation remains read-only
    And no MemoryAuthorityState transition occurs

  Scenario: The same recommendation basis is evaluated again later
    Given a recommendation already exists for one memory revision and evaluator version
    When the same normalized signal basis is appended with a later evaluation timestamp
    Then the append is treated as an exact replay
    And the first persisted recommendation timestamp is retained
    And no duplicate recommendation is stored

  Scenario: Recommendation identity is forged
    Given a recommendation id does not match its memory revision, evaluator version and normalized signals
    When persistence is attempted
    Then the repository fails closed
    And no recommendation is stored

  Scenario: Recommendation basis becomes stale
    Given a persisted quarantine recommendation
    When the memory lifecycle revision, evaluator version or normalized active signals change
    Then the recommendation is marked stale
    And it is not silently rewritten into a current recommendation

  Scenario: Durable recommendation history is restarted
    Given valid quarantine recommendations were persisted locally
    When the repository starts again
    Then it reconstructs each recommendation through the same validation contract
    And exact replay remains idempotent

  Scenario: Durable recommendation history is corrupt or tampered
    Given the local recommendation file contains invalid JSON or an altered integrity-bound record
    When the repository reads the history
    Then it fails closed
    And no corrupt recommendation gains authority
