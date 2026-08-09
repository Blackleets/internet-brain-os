Feature: Repeated persisted failures produce bounded prevention recommendations
  Efesto may identify repeated explicit failures so an operator can review a pattern,
  but a recommendation never gains authority to mutate Memory, policy, capabilities,
  approvals, or external systems.

  Scenario: Repeated validation failures cross the configured threshold
    Given three persisted claim-validation records cite the explicit reason code "missing_evidence"
    And all three occurred inside the configured deterministic time window
    When the repeated-failure prevention evaluator runs
    Then it emits one deterministic read-only recommendation
    And the recommendation cites the exact three persisted failure reference IDs
    And it recommends reviewing evidence quality
    And it does not infer hidden agent intent

  Scenario: A pattern remains below threshold
    Given only two qualifying persisted failures exist inside a threshold of three
    When the repeated-failure prevention evaluator runs
    Then it emits no prevention recommendation

  Scenario: Exact replay does not inflate the failure count
    Given the same persisted failure reference is supplied twice with identical content
    When the repeated-failure prevention evaluator runs
    Then the reference counts once
    And the recommendation identity remains deterministic

  Scenario: Altered replay is rejected
    Given a persisted failure reference ID was already supplied with one explicit failure code
    When the same reference ID is supplied with altered failure content
    Then evaluation fails closed
    And no prevention recommendation is emitted from the altered replay

  Scenario: Recommendation basis becomes stale
    Given a prevention recommendation cites an exact persisted failure basis
    When the evaluator version changes or the cited failure basis changes
    Then the recommendation is marked stale
    And no policy or authority state is changed automatically

  Scenario: A failed execution is projected from durable execution history
    Given an execution was reserved, became in doubt, and was durably reconciled as failed
    When repeated-failure inputs are projected
    Then only the latest failed execution state is used
    And the failure reference contains the execution ID, sequence, capability scope, and explicit failure code

  Scenario: Validation and admission failures are projected from cognitive pipeline history
    Given a persisted cognitive pipeline contains a rejected validation reason and a blocked admission reason
    When repeated-failure inputs are projected
    Then only explicit persisted reason codes become failure references
    And agent thoughts, inferred motives, and private chain-of-thought are not failure signals
