Feature: Deterministic memory quarantine recommendations
  The Kernel may record why an eligible memory should be reviewed for quarantine,
  but a recommendation must never become lifecycle authority by itself.

  Scenario: Persisted deterministic signals create one reproducible recommendation
    Given an admitted or proposed memory at a known lifecycle revision
    And one or more persisted quarantine signals reference durable Evidence, contradiction, policy or provenance records
    When the Kernel evaluates quarantine recommendation state
    Then the signal set is normalized deterministically
    And the recommendation identity is derived from normalized persisted content
    And replaying the same signals in a different order returns the same recommendation identity

  Scenario: A model or agent assertion alone cannot recommend quarantine
    Given no persisted deterministic quarantine signal exists for the current memory revision
    When Hermes, another model, or an operator narrative says the memory looks unsafe
    Then no quarantine recommendation is created from that assertion alone

  Scenario: A recommendation cannot authorize the lifecycle transition
    Given a valid pending quarantine recommendation exists
    When the lifecycle validator receives an admitted to quarantined transition without hasPersistedQuarantineSignal
    Then the transition is rejected with MISSING_QUARANTINE_SIGNAL
    And the recommendation does not substitute for Kernel transition authority

  Scenario: A recommendation becomes stale when authority state advances
    Given a valid recommendation was calculated for lifecycle revision 2
    When the memory advances to lifecycle revision 3
    Then the old recommendation is stale
    And it cannot be treated as current quarantine evidence

  Scenario: Terminal and already quarantined states do not create new quarantine recommendations
    Given a memory is quarantined, rejected, superseded, or revoked
    And persisted signals exist
    When the Kernel evaluates a new quarantine recommendation
    Then the result is not recommended because the lifecycle state is not eligible

  Scenario: Durable recommendation tampering fails closed
    Given a recommendation was persisted with its deterministic integrity digest
    When its durable content is altered without recomputing the original identity
    Then the repository refuses to load the altered recommendation
    And no lifecycle transition occurs
