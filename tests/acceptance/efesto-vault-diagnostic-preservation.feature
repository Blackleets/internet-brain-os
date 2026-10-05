Feature: Vault diagnostics preserve user files
  Checking whether Obsidian can be written must never overwrite a vault entry.

  Scenario: The vault already contains the historical probe filename
    Given a configured vault contains a user file named .efesto-write-test
    When Efesto checks whether the vault is writable
    Then the original file contents are unchanged
    And only the exclusive temporary file created by that check is removed

  Scenario: Several diagnostics run simultaneously
    Given a configured writable vault contains saved notes
    When eight vault checks run simultaneously
    Then each check uses a separate exclusively created probe
    And all saved notes remain unchanged
    And no owned probe remains after successful completion

  Scenario: The configured vault path is a file
    Given the configured vault path refers to an existing user file
    When Efesto checks whether the vault is writable
    Then the diagnostic reports an unwritable vault
    And the existing file remains unchanged
