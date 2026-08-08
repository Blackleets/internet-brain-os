Feature: Evidence-backed temporal Knowledge Graph
  Efesto may connect Entities and Relationships and project time-bounded facts
  only while preserving Evidence provenance and historical supersession.

  Scenario: Current price is known
    Given an evidence-backed product Entity
    And an evidence-backed temporal price fact
    When the owner asks what Efesto knows about the product
    Then the Entity, connected Relationships and active price are returned
    And the price retains its Evidence references

  Scenario: A price changes
    Given an older price fact
    And a newer price fact explicitly supersedes it
    When knowledge is projected after the newer fact became valid
    Then only the newer price is current
    And the older fact remains in append-only history

  Scenario: Unsupported knowledge without Evidence
    Given a temporal property has no Evidence
    When it is proposed to the graph
    Then the Kernel rejects it

  Scenario: Altered replay
    Given a temporal property id already exists
    When different content reuses that id
    Then the Kernel rejects the altered replay
