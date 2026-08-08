Feature: Evidence-first Opportunity Intelligence v2
  Efesto ranks opportunities using evidence provenance, Goal fit, freshness and explicit user feedback
  without rewriting the classifier's Evidence relevance or inferring private preferences.

  Scenario: Provenanced opportunity outranks an otherwise identical weak lead
    Given two equally relevant opportunities
    And one has both Case and Evidence provenance
    When Efesto ranks them
    Then the fully provenanced opportunity scores higher
    And both retain their original relevance scores

  Scenario: Explicit useful feedback adjusts ranking
    Given an opportunity with explicit positive preference feedback
    When Efesto ranks the opportunity
    Then its preference component increases
    And the ranking explanation says explicit feedback contributed

  Scenario: Old opportunity loses freshness
    Given a fresh and a stale opportunity with otherwise equal signals
    When Efesto ranks them
    Then the fresh opportunity scores higher

  Scenario: Ranking is not authority
    Given an opportunity has the highest personalized score
    Then it is still only an Opportunity
    And ranking does not admit Memory
    And ranking does not execute any capability
