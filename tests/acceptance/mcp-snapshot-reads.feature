Feature: MCP tools are pure reads of Kernel snapshots
  Scenario: A historical expired lease is visible without repair
    Given a stored running mission whose lease has expired
    When an authorized local MCP client lists missions
    Then the persisted mission is returned without a clock error
    And its status and lease are unchanged
    And every byte of the knowledge store remains unchanged

  Scenario: MCP does not repair missing or corrupt storage
    Given the knowledge store is absent or contains invalid JSON
    When an authorized local MCP client requests stored knowledge
    Then absent storage is not created
    And corrupt storage returns a structured error without modification
    And Kernel authentication and reconciliation remain separate
