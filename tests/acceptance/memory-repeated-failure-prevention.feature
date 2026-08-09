Feature: Repeated failure prevention recommendations
  Efesto may summarize repeated persisted failures into read-only prevention recommendations without inferring hidden intent or changing authority.

  Scenario: Repeated failures cross the policy threshold
    Given three persisted failures share one memory id and failure category inside the bounded policy window
    When the Kernel evaluates repeated failure patterns
    Then it emits one deterministic prevention recommendation
    And the recommendation cites the exact failure ids and persisted reference ids
    And its authority is read only

  Scenario: Failures do not cross threshold
    Given fewer persisted failures than the configured threshold
    When the Kernel evaluates repeated failure patterns
    Then no prevention recommendation is emitted

  Scenario: Old and future records are outside the evaluation window
    Given persisted failures occurred before the bounded window or after the evaluation time
    When the Kernel evaluates repeated failure patterns
    Then those records do not count toward the threshold

  Scenario: Unrelated failures must not be blended
    Given failures refer to different memory ids or different categories
    When the Kernel evaluates repeated failure patterns
    Then unrelated groups remain separate
    And they cannot combine to cross a threshold

  Scenario: Exact repeated failure replay is deduplicated
    Given the same persisted failure id and normalized payload appears more than once
    When the Kernel evaluates repeated failure patterns
    Then the failure counts once
    And the resulting recommendation id is stable

  Scenario: One persisted failure id carries conflicting facts
    Given the same failure id is supplied with different persisted data
    When the Kernel evaluates repeated failure patterns
    Then evaluation fails closed

  Scenario: Prevention policy or active failure basis changes
    Given a prevention recommendation was derived under one policy and failure set
    When the policy version, threshold, window, or active failure ids change
    Then the previous recommendation is stale
    And it is not silently rewritten or executed

  Scenario: Model speculation is not a failure record
    Given an agent or model says a failure pattern looks suspicious
    And no matching persisted failure records exist
    When prevention evaluation runs
    Then no trusted prevention recommendation is emitted
    And no capability, policy, approval or memory authority changes automatically
