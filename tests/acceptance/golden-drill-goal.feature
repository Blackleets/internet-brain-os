Feature: Golden autonomous Goal journey
  Efesto should turn a bounded economic Goal into evidence-backed discovery and a user notification without performing an irreversible action.

  Scenario: Find a quality drill inside the requested budget
    Given the user Goal is to find a quality drill between 18 and 25 EUR
    And the Goal authorizes only public web search and read capabilities
    When the current plan executes web.search
    And a candidate public URL is discovered
    And web.read captures the candidate page
    Then a Case and Evidence record retain the source and captured text
    And Opportunity Intelligence ranks the candidate with Case and Evidence provenance
    And a new-match Trigger emits one deterministic event
    And Notification Gateway queues one deduplicated alert linked to the Evidence
    And no purchase login form submission or Memory admission occurs

  Scenario: Golden journey replay is safe
    Given the same trigger event and Evidence were already notified
    When the exact notification is replayed
    Then the original notification is returned
    And the inbox contains only one notification
