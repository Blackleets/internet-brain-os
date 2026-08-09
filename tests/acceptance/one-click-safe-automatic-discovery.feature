Feature: One-click safe automatic discovery
  As an Efesto user
  I want confirmed Goals to continue safe public discovery automatically
  Without an unsafe Hermes installation being treated as authorized execution

  Scenario: Certified Hermes starts automatic discovery
    Given Hermes is installed
    And the read-only capability probe passes
    And the Goal has a current trusted read-only receipt
    When the Mission is queued
    Then the Kernel exposes read-only runtime readiness
    And the automatic claim gate may issue a bounded discovery lease
    And Hermes runs only safe search-only discovery

  Scenario: Installed but incompatible Hermes stays blocked
    Given Hermes is installed
    But the read-only capability probe fails
    When the Mission is queued
    Then Hermes remains visible as installed
    But read-only runtime readiness is false
    And automatic claim eligibility returns runtime_read_only_unverified
    And no broad one-shot fallback executes
