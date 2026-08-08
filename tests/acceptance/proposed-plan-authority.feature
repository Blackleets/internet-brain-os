Feature: Proposed plans remain immutable proposals without execution authority
  A model or agent may propose bounded work for a Goal, but the Kernel must preserve Goal identity,
  revision history, capability policy, and concurrency before any later approval boundary exists.

  Scenario: Create a proposal with explicitly allowed capabilities
    Given a Goal explicitly allows public_web_research
    When a proposed plan requests public_web_research
    Then the Kernel stores revision 1 as draft
    And the proposal receives no execution lease or action authority

  Scenario: Deny a capability by default
    Given a Goal does not explicitly allow purchase
    When a proposed plan requests purchase
    Then the Kernel rejects the proposal
    And no plan revision is written

  Scenario: Preserve the parent Goal across updates
    Given a proposed plan is bound to Goal A
    When a caller includes Goal B in an update payload
    Then the update cannot change the plan Goal identity
    And every stored revision remains bound to Goal A

  Scenario: Reject stale concurrent updates
    Given revision 2 is the current proposal revision
    When a caller submits an update expecting revision 1
    Then the Kernel rejects the update as a revision conflict
    And no additional revision is appended

  Scenario: Append a valid revision without rewriting history
    Given revision 1 is current
    When a caller submits a valid update expecting revision 1
    Then revision 2 is appended
    And revision 2 links to revision 1
    And revision 1 remains unchanged

  Scenario: Reject malformed task graphs
    Given a proposed plan contains duplicate task identities, unknown dependencies, excessive depth, or a cycle
    When the Kernel validates the plan
    Then the proposal is rejected fail-closed
    And no proposal revision is persisted

  Scenario: Caller-owned objects cannot rewrite stored history
    Given a valid plan revision has been persisted
    When the caller later mutates its source arrays or nested task objects
    Then the persisted plan content remains unchanged
    And its content hash remains bound to the original canonical content
