Feature: Authentic public-web Goal journey acceptance
  The live Hermes acceptance mode must prove product value provenance, not merely terminal execution.

  Scenario: Authentic Hermes produces search candidates before Kernel verification
    Given the isolated live acceptance Kernel has an authentic Hermes runtime
    And the founder explicitly confirms a read-only public-web Goal
    When Hermes discovers public sources
    Then at least one bounded searchCandidate is persisted
    And the candidate remains distinct from Evidence until Kernel web.read verifies it

  Scenario: Kernel verification creates Evidence and a Find
    Given a persisted searchCandidate was returned by authentic Hermes
    When Kernel web.read independently fetches the public source
    Then Evidence is created with missionId and candidateId provenance
    And its source receipt identifies Kernel web.read
    And at least one promoted Find for the tested Goal resolves to that Evidence

  Scenario: Agent output cannot satisfy the Evidence check
    Given Hermes returned a title and snippet
    But no Kernel web.read Evidence receipt exists
    When the live journey is assessed
    Then the Evidence-backed Find check fails
    And terminal Mission status alone is insufficient for acceptance

  Scenario: Shared Goal Truth must converge with the same forged Mission
    Given the live Mission completed after Kernel verification
    When the acceptance runner reads the Goal surface
    Then sourceOfTruth is kernel
    And the surface Mission id matches the tested Mission
    And its workState is forged

  Scenario: Deterministic CI does not depend on Internet or live Hermes
    Given the acceptance runner is executed without --live
    When the boundary-authority suite runs
    Then the existing isolated deterministic checks remain in use
    And no real public-web value assertion is silently substituted into default CI
