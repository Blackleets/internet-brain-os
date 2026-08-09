Feature: Shared Goal Truth v1
  Efesto should expose one Kernel-owned read projection of persisted Goal and Mission truth
  so product surfaces can converge without inventing authority or duplicate state machines.

  Scenario: Legacy radar Goal remains an explicit compatibility representation
    Given the local store contains a radar Goal created by the current product path
    When Hephaestus builds GoalSurfaceSnapshot v1
    Then the snapshot source of truth is the Kernel
    And the Goal compatibility is legacy_radar
    And legacy compatibility defaults are labelled as compatibility policy
    And the projection does not claim that the legacy record is already UniversalGoal v2

  Scenario: Canonical Goal lifecycle stays separate from Mission work state
    Given a UniversalGoal v2 is active
    And its current Mission is running in the investigating phase
    When Hephaestus builds the Goal surface snapshot
    Then the Goal status remains active
    And the Mission work state is investigating
    And the Mission phase does not silently rewrite Goal lifecycle

  Scenario: Current Mission selection is deterministic and isolated by Goal
    Given one Goal has active and terminal Mission history
    And another Goal has its own running Mission
    When Hephaestus selects the current Mission for the first Goal
    Then active work is preferred over terminal history according to the frozen selection rule
    And Missions belonging to another Goal are excluded
    And ties are resolved deterministically from persisted timestamps and identity

  Scenario: Local Goal surface adapter is read-only
    Given Goals and agent Missions are persisted in the local knowledge store
    When the GoalSurfaceReader lists or gets a Goal surface
    Then it reads the persisted Goals and Missions
    And it delegates projection semantics to the Kernel Goal surface projector
    And it never calls the store project or write path
    And an invalid Goal identity is rejected before the store is read

  Scenario: Goal surface API list and detail require authentication
    Given the local Kernel exposes Shared Goal Truth v1
    When a client requests /api/goal-surfaces without the Kernel API token
    Then the request is rejected before the Goal surface reader runs
    When an authenticated client requests the list or one Goal detail
    Then the response contains only the Kernel-owned Goal surface projection
    And an unknown Goal returns not found instead of fabricated state

  Scenario: Goal surface API remains GET-only
    Given Shared Goal Truth v1 is available through the local Kernel
    When a client attempts to POST to /api/goal-surfaces
    Then no Goal-surface writer route exists
    And the request cannot create, mutate, approve, pause, complete or cancel a Goal
    And the existing Goal and Mission write routes remain separate authority paths

  Scenario: Extension identity protection still applies to Shared Goal Truth
    Given an extension origin has not been authorized by the local Kernel identity registry
    When it requests /api/goal-surfaces with a Kernel token
    Then the request is rejected by the extension identity gate
    And no Goal surface read occurs

  Scenario: Goal surface projection grants no additional authority
    Given a Goal surface snapshot contains Goal policy summary and Mission work state
    When a dashboard or extension consumes that snapshot in a later product slice
    Then the snapshot grants no capability, approval, external side effect or durable-memory authority
    And the client must continue using the existing Kernel policy and approval paths for actions

  Scenario: G1 freezes the shared truth before product surfaces consume it
    Given Shared Goal Truth v1 is merged and qualified
    Then G1 itself does not redesign the Control Center
    And G1 itself does not redesign the browser extension
    And the responsive Control Center may consume the frozen projection only in G2
    And the extension may consume the same frozen projection only in G3
