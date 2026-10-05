Feature: Launcher readiness belongs to the requested Kernel endpoint
  Scenario Outline: A local health or runtime bootstrap endpoint redirects
    Given a launcher readiness endpoint replies with HTTP <status>
    And the redirect target would claim that Efesto is ready
    When the launcher inspects that endpoint
    Then no request reaches the redirect target
    And redirected readiness is not accepted
    And no user data or Kernel authority is changed

    Examples:
      | status |
      | 301    |
      | 302    |
      | 307    |
      | 308    |

  Scenario: The Kernel directly reports a blocked Hermes runtime
    Given the requested Kernel endpoint responds directly with valid bootstrap status
    And Hermes is invalid
    When the launcher reads runtime readiness
    Then that blocked state is preserved without substitution
