Feature: One-line Goal intent enrichment
  Efesto should preserve a simple Goal composer while the Kernel derives bounded discovery intent.

  Scenario: A natural shopping Goal preserves product and price intent
    Given the user types "Find a good-quality drill in Spain for €18–€25 from reputable sellers."
    And the active Home does not ask for category or price fields
    When the Kernel validates the Goal
    Then it infers supported categories including offer and tool
    And it preserves 18 and 25 as bounded Goal keywords
    And it creates no purchase or payment authority

  Scenario: Hourly freelance pay is not mistaken for shopping intent
    Given the user types a remote freelance Goal at $20–$30 per hour
    When the Kernel enriches the Goal
    Then job and client intent are available for matching
    And 20 and 30 are preserved as keywords
    But the currency amount alone does not infer offer intent

  Scenario: Explicit category intent wins
    Given a trusted client explicitly supplies a supported Goal category
    When the Kernel validates the Goal
    Then the explicit category remains unchanged
    And title inference does not replace it

  Scenario: Generic text remains invalid
    Given a Goal has no explicit categories or keywords
    And its title contains no supported discovery intent
    When the Kernel validates the Goal
    Then the Goal is rejected as invalid
    And no Mission is created by Goal validation

  Scenario: Unsupported categories still fail closed
    Given a client supplies an unsupported category such as wallet
    When the Kernel validates the Goal
    Then the Goal is rejected
    And inference cannot convert the unsupported category into a valid one
