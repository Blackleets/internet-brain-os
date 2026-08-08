Feature: Local notifications are durable, deduplicated projections
  Efesto may surface an already-authorized result to the owner
  without allowing the notification layer to become a truth or execution authority.

  Scenario: Trigger event becomes one local notification
    Given a verified TriggerEvent bound to a Goal
    When the notification is queued with a stable dedupe key
    Then exactly one unread notification is persisted
    And exact replay returns the same notification
    And Evidence references remain attached

  Scenario: Altered replay under the same dedupe key
    Given a notification already exists
    When different content reuses its dedupe key
    Then the request fails closed

  Scenario: Owner reads and dismisses a notification
    Given an unread local notification
    When the owner marks it read and later dismisses it
    Then the append-only receipt history preserves those transitions
    And the projected inbox reports dismissed

  Scenario: Notification authority boundary
    Given a notification is queued
    Then no capability executes
    And no Memory is admitted
    And no claim becomes trusted solely because of the notification
