Feature: Legacy memory migration planning is dry-run and fail-closed
  Legacy memories without an authority receipt chain may be identified for reviewed migration,
  but planning must never create authority, mutate memory, or admit a record.

  Scenario: Plan a reconciled legacy memory for reviewed migration
    Given a legacy memory is classified as migration_required by startup reconciliation
    And its memory identity is unique
    When the Kernel builds the legacy migration plan
    Then the plan action is plan_migration
    And the proposed initial authority state is proposed
    And required Evidence identifiers are normalized and deduplicated
    And no receipt, admission, or memory write occurs

  Scenario: Leave a valid authority chain unchanged
    Given a memory already has a valid reconciled authority chain
    When the Kernel builds the legacy migration plan
    Then the plan action is no_action
    And no replacement authority history is fabricated

  Scenario: Block unresolved integrity or reference failures
    Given startup reconciliation reports an integrity_failure or missing_reference
    When the Kernel builds the legacy migration plan
    Then the plan action is blocked
    And no migration authority is proposed

  Scenario: Block ambiguous identities
    Given duplicate memory identities or duplicate reconciliation identities exist
    When the Kernel builds the legacy migration plan
    Then every ambiguous record is blocked
    And no ambiguous memory receives migration authority

  Scenario: Returned Evidence references are defensive
    Given a migration plan has already been created
    When a caller mutates its own source Evidence array
    Then the previously returned plan remains unchanged
