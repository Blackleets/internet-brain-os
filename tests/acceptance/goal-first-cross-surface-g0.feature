Feature: Goal-first cross-surface product contract
  Efesto should let a person state one Goal and observe the same persisted truth
  across its operational surfaces without duplicating authority or fabricating work.

  Scenario: Draft and prepared Goal remain local until explicit confirmation
    Given a user is composing a Goal in an Efesto client
    When the Goal is still draft or prepared
    Then no persisted Goal or Mission write has occurred
    And another client must not present the draft as Kernel truth
    When the user explicitly confirms the permitted Goal policy
    Then the Kernel may persist the Goal and create authorized work

  Scenario: Confirmed Goal permits automatic read-only work inside its policy
    Given an active Goal permits public read-only research
    And the user has confirmed that Goal policy
    When Efesto schedules or continues allowed research
    Then it may run the permitted read-only work without redundant per-step confirmation
    But purchase, login, form submission, outreach, download and destructive actions remain separately approval gated
    And Goal confirmation grants no direct durable-memory authority

  Scenario: Dashboard and extension project the same persisted Goal truth
    Given the Kernel has a persisted Goal and current Mission
    When the responsive Control Center and browser extension display that Goal
    Then both derive persisted Goal state from the same Kernel-owned projection
    And neither client maintains an independent persisted Goal database
    And Mission execution phase is not silently rewritten into Goal lifecycle status

  Scenario: Living Forge motion is truthful
    Given no persisted or streaming work is active
    When the Goal surface is ready, paused, failed or offline
    Then active-work forge motion is not shown
    Given a Mission is observably queued, investigating or verifying
    Then the surface may show the corresponding bounded work motion
    And animation alone never counts as evidence that work happened

  Scenario: Responsive Goal experience remains usable on mobile width
    Given the Control Center viewport is 390 by 844 pixels
    When the Goal-first Home surface is displayed
    Then the Goal, current work state, Mission progress and Finds follow one vertical hierarchy
    And primary controls remain usable without horizontal overflow
    And reduced-motion mode preserves all information needed to understand state

  Scenario: Public landing never becomes a private runtime authority surface
    Given a visitor opens the public Efesto landing
    Then it may explain Goals and offer install or open actions
    But it must not receive the private Kernel token
    And it must not display private persisted Goals
    And it must not fabricate live autonomous work

  Scenario: Mobile-width support does not imply remote PC authority
    Given the current Kernel trust boundary is loopback and local-first
    When the responsive Control Center is accepted at mobile width
    Then the product may claim responsive mobile-width usability
    But it must not claim that an arbitrary phone can remotely control a Kernel running on another PC
    Until a separately threat-modelled secure cross-device transport is implemented
