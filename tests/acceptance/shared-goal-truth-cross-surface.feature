Feature: Shared Goal Truth across Efesto product surfaces
  The Kernel remains the only persisted Goal truth while responsive web and the browser extension present the same observable work state.

  Scenario: Web and extension read the same Kernel projection
    Given a persisted Goal and current Mission exist in the local Kernel
    When the Control Center and paired extension refresh
    Then both clients read schema "efesto.goal-surface.v1"
    And both require sourceOfTruth "kernel"
    And neither client may create a separate persisted Goal state machine

  Scenario: Conflicting legacy presentation cannot override Shared Goal Truth
    Given a legacy Mission compatibility view says work is completed
    And Shared Goal Truth says the current workState is verifying
    When a product surface renders the Goal
    Then the surface presents verifying
    And it does not claim forged Evidence

  Scenario: Research remains explicitly authorized
    Given an active Goal has no current blocking work
    When the user chooses Research in the extension
    Then the existing explicit authorization prompt is required
    And the existing Mission writer is used
    And no write route exists under /api/goal-surfaces

  Scenario: A Goal controls only its own Research button
    Given multiple Goals have different projected work states
    When the extension renders Goal chips
    Then each Research button uses that Goal's workState and canResearch
    And another Goal's focused state cannot enable a paused or active-work Goal

  Scenario: Shared Goal Truth failure fails visually closed
    Given the paired extension cannot read Shared Goal Truth
    When the extension refreshes
    Then it reports Goal truth unavailable
    And the Living Forge enters a non-success error presentation
    And stale legacy success is not retained as current truth

  Scenario: Reduced motion preserves meaning
    Given the user prefers reduced motion
    When the Control Center or extension shows observable work
    Then continuous decorative motion is disabled
    And textual state meaning remains available

  Scenario: Mobile-width does not create remote authority
    Given the responsive Control Center is rendered at 390 by 844
    Then the Goal workflow remains usable without horizontal overflow
    And this layout support does not grant a phone remote authority over another device's local Kernel
