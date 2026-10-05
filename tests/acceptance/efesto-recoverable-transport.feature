Feature: Recoverable Efesto transport preserves Kernel authority
  Background:
    Given research remains bounded by an existing Kernel authorization and lease
    And search candidates are not Evidence or SUPPORT

  Scenario: Response headers arrive but the body stalls
    When the request deadline expires while reading the Kernel response body
    Then the worker and dashboard expose a timeout
    And malformed JSON is not used to hide that timeout
    And the worker reconciles persisted state before reporting a submission failure

  Scenario: An incomplete response must not authorize or complete research
    When the Kernel claim lacks a mission identity or lease
    Then no Hermes adapter is invoked
    When a candidate submission response does not confirm that same mission
    Then persisted Kernel state is checked
    And completion is not fabricated from HTTP success

  Scenario: Authenticated local calls receive a redirect
    When a worker or dashboard request receives a redirect
    Then the redirect is rejected
    And the local authentication token is not forwarded

  Scenario: Goal editing cannot confirm a save
    Given the user has typed a revised Goal
    When the revision callback rejects or returns an unconfirmed result
    Then the edited text is retained
    And the controls recover with a safe unconfirmed-save explanation
    And the user can retry without duplicate overlapping submissions
    And keyboard navigation remains inside the edit dialog
