Feature: Capability Registry authority boundary
  Efesto must know what a plan is allowed to request before any execution layer can exist.

  Scenario: Registered observation capability is authorized
    Given a Goal allows capability "web.search" and data scope "public_web"
    And the Capability Registry contains healthy version "1" of "web.search"
    When a Proposed Plan requests "web.search" version "1"
    Then the capability request is authorized
    And no execution authority is granted by the authorization itself

  Scenario: Unknown capability fails closed
    Given a Goal names capability "commerce.purchase"
    And "commerce.purchase" is not registered
    When a Proposed Plan requests "commerce.purchase"
    Then the request is rejected as an unknown capability

  Scenario: Goal cannot authorize more scope than the registry definition permits
    Given "web.search" requires data scope "public_web"
    And the Goal does not allow "public_web"
    When the Proposed Plan requests "web.search"
    Then the request is rejected before plan execution

  Scenario: Unhealthy capability cannot be planned for execution
    Given "web.search" is registered but unavailable
    When an otherwise valid Goal requests "web.search"
    Then the request is rejected as unavailable

  Scenario: Version mismatch is explicit
    Given version "1" of "web.search" is registered
    When a Proposed Plan requests version "2"
    Then the request is rejected with a version mismatch

  Scenario: Higher risk capability carries consent metadata
    Given a registered capability has consent policy "always"
    When the registry authorizes the capability within Goal scope
    Then the authorization reports that consent is required
    And the registry does not approve or execute the action
