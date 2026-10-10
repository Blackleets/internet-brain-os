Feature: Private diagnosis of rejected Hermes output
  Scenario: Parsed output violates the bounded findings contract
    Given a confirmed mission whose adapter returns an invalid findings shape
    When the adapter validates the parsed response
    Then the response is rejected without candidate submission
    And the failure reports only fixed JSON types and a bounded count category
    And no model text, source URL, key or private value enters the shape diagnostic
    And Kernel verification and bounded retry authority remain unchanged
