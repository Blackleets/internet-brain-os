Feature: Installation identity without runtime side effects
  Scenario: Inspect a checkout before deciding how to update it
    Given an Efesto checkout with valid internal release metadata
    When the operator runs the installation identity command
    Then the exact Git commit and clean or modified state are reported
    And no filename, local path or credential is printed
    And no runtime, vault diagnostic or network request starts

  Scenario: Inspect an extracted package inside another repository
    Given an exact Git archive with its expanded build commit marker
    When the operator runs the installation identity command
    Then the archived Efesto commit is reported instead of its parent repository
    And runtime readiness and package authenticity remain unverified

  Scenario: Inspect a legacy or malformed package
    Given no valid Git or archived commit identity exists
    When the operator runs the installation identity command
    Then the commit is unknown rather than fabricated
