Feature: Hermes safe automatic discovery runtime
  As Hephaestus
  I want Hermes automatic discovery technically restricted to public search
  So that prompt instructions are not the security boundary

  Scenario: Compatible Hermes runtime is certified for discovery
    Given Hermes advertises quiet query, max-turns, toolsets and isolated configuration flags
    When Efesto probes the runtime
    Then it is certified as bounded_isolated_search_only
    And required arguments include chat --query --quiet --max-turns --ignore-rules --toolsets search
    And the exclusive ephemeral profile limits Hermes to 8 turns

  Scenario: Older Hermes runtime fails closed
    Given Hermes does not advertise isolated configuration flags or toolsets
    When Efesto probes the runtime
    Then read-only readiness is denied
    And Efesto does not fall back to an unrestricted execution path

  Scenario: Automatic discovery has no broad toolsets
    Given a certified Hermes runtime
    When Efesto builds the bounded quiet-query command
    Then only the search toolset is enabled
    And terminal, file, browser, computer-use and messaging tools are absent
    And private URL allowance is forced off

  Scenario: Search output is not trusted knowledge
    Given Hermes returns public search snippets
    Then those results remain discovery candidates
    And no snippet is considered verified Evidence merely because Hermes returned it
