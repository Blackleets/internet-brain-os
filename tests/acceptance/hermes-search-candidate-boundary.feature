Feature: Hermes discovery candidates are not Evidence
  As Hephaestus
  I want agent discovery separated from source verification
  So that search snippets cannot become trusted knowledge by assertion

  Scenario: Search results await Kernel verification
    Given Hermes has a valid automatic discovery lease
    When Hermes returns public search results
    Then results are persisted as deduplicated searchCandidates
    And the Mission enters verifying
    And Evidence created is zero
    And promoted Finds are zero
    And the discovery lease is released

  Scenario: Exact candidate replay is idempotent
    Given candidate results were persisted but the HTTP response was lost
    When the worker retries the exact same candidate batch
    Then persisted state does not change
    And no Evidence or Find is duplicated

  Scenario: No search results completes calmly
    Given Hermes has a valid automatic discovery lease
    When Hermes returns no candidates
    Then the Mission becomes completed
    And execution is not presented as forged
    And Evidence created is zero

  Scenario: Manual historical completion remains compatible
    Given a non-automatic Agent Hub completion without resultKind search_candidates
    When the legacy completion path is invoked
    Then the existing bounded manual behavior remains delegated unchanged
