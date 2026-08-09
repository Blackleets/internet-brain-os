Feature: Kernel web.read is the Evidence boundary
  As Hephaestus
  I want every search candidate re-read through the trusted public-web reader
  So that snippets and agent assertions cannot become Evidence

  Scenario: Verified public page becomes Evidence
    Given a Mission has pending search candidates and a current read-only authorization
    When Kernel verification runs
    Then CapabilityRegistry authorizes the real web.read capability
    And the PublicWebReadExecutionAdapter reads each candidate through WebPageFetcher
    And only fetched page text becomes Evidence
    And the original search snippet is not persisted as Evidence

  Scenario: Goal authority changes during fetch
    Given web.read was allowed when verification started
    But the Goal is paused or revised before persistence
    When the page fetch finishes
    Then authorization is evaluated again
    And no Evidence or Find is persisted from the stale operation

  Scenario: Every read fails safely
    Given all candidate page reads fail
    When Kernel verification finishes
    Then the Mission remains verifying
    And Evidence created is zero
    And retry remains safe

  Scenario: Exact verification replay is idempotent
    Given verified Evidence was already persisted for the candidate batch
    When verification is invoked again
    Then no duplicate Case, Evidence or Find is created
