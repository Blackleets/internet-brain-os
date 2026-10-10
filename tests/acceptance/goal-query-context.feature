Feature: Economic Goal discovery preserves its subject
  Scenario: Inferred price keywords cannot replace a Goal's topic
    Given a confirmed Goal requesting a drill in Spain for 18 to 25 euros
    And intent enrichment retained numeric price keywords
    When the Hermes adapter plans bounded public searches
    Then its primary search retains the authorized Goal title
    And drill, Spain and the price range remain present
    And no search result becomes Evidence without Kernel verification

  Scenario: A late skill survives the short selection-term budget
    Given a confirmed remote freelance Goal mentioning React and 20 to 30 dollars per hour
    When the Hermes adapter plans bounded public searches
    Then its primary search retains React and remote freelance work
    And no location, skill or number is invented
