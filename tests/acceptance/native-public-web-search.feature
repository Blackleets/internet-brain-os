Feature: Native public web search
  Efesto must discover public sources through a bounded read-only capability without giving search providers or agents execution authority.

  Scenario: Authorized Goal performs public discovery
    Given a Goal authorizes web.search over public_web data
    And its current Proposed Plan requests web.search version 1
    When the Execution Engine runs the search action
    Then the fixed public search provider is queried
    And bounded normalized results are returned with title URL snippet and source host
    And the execution receipt remains bound to the Goal and plan revision

  Scenario: Unauthorized search fails closed
    Given a Goal does not authorize web.search
    When a plan attempts to execute web.search
    Then the Execution Engine rejects the action before the search provider is used

  Scenario: Invalid query fails before external I/O
    Given a web.search execution contains blank oversized or control-character query input
    When the adapter validates the payload
    Then it rejects the request
    And no external search call is made

  Scenario: Search is observation-only
    Given web.search is available
    Then its capability risk is r0_observe
    And it requires no credential scope
    And it cannot submit forms purchase products send messages or mutate Memory

  Scenario: Search provider response is bounded
    Given the public search provider returns excessive or non-HTML content
    When Efesto reads the response
    Then the connector fails closed
    And no unbounded provider response is persisted as an execution result
