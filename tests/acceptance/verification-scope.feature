Feature: Topic relevance does not certify commercial conditions
  Scenario: A supported source exposes the limits of its verification
    Given Kernel-fetched Evidence linked to a Mission and a true SUPPORT decision
    When an authenticated client reads Mission Evidence
    Then the scope is term coverage only
    And price, availability and freshness are not assessed
    And stored or agent-supplied claimed verification cannot override those limits
    And the Evidence, SUPPORT and source records remain unchanged

  Scenario: Older Kernel responses do not imply certified conditions
    Given a valid older Mission Evidence response without verificationScope
    When the dashboard parses it
    Then commercial conditions remain not assessed
    But an explicit unsupported or malformed verification scope is rejected

  Scenario: Verification scope is accessible on a phone and desktop
    Given a supported source card at 390px or 1280px
    When the user opens Qué respalda esta fuente using Enter
    Then it explains topic relevance and unevaluated conditions
    And its summary has a 44px touch target
    And SUPPORT and Find actions remain intact
    And no horizontal overflow occurs
