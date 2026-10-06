Feature: Daily startup with explicit persistent browser authorization
  Scenario: Sign in after enabling startup
    Given Efesto is installed and its owner enabled automatic startup
    When Windows starts the owner's session
    Then the launcher starts the local Kernel without interactive prompts
    And it does not replace a healthy Kernel or terminate a foreign process
    And it does not install dependencies or start a research mission

  Scenario: Reopen the explicitly approved web
    Given the extension is paired and its owner enabled web reconnection
    When the owner opens the production Efesto root page
    Then the dashboard restores the connection through the extension
    And no private Kernel token is delivered to or persisted by the web
    And readiness is read from the real Kernel before showing it ready

  Scenario: Deny unapproved callers
    Given the extension is paired
    When another origin or embedded frame requests a Kernel operation
    Then no Kernel request is made
    And worker authority routes remain unavailable through the dashboard bridge

  Scenario: Revoke reconnection
    Given the dashboard is connected through the approved extension
    When the owner disconnects or unchecks web reconnection
    Then active proxy requests are cancelled
    And reopening the web cannot reconnect until consent is enabled again

  Scenario: Remove startup without touching unrelated files
    Given this installation owns its automatic startup shortcut
    When the owner disables automatic startup
    Then only that shortcut is removed
    And user data and unrelated startup entries are preserved
