Feature: Responsive dashboard consumes the Kernel-owned product scorecard
  The active Efesto product shell must display local product value without creating a second metric truth.

  Scenario: Kernel scorecard is visible on the active Home surface
    Given the authenticated Kernel returns efesto.product-scorecard.v1
    And its sourceOfTruth is local_kernel
    And externalTelemetry is false
    When the active Efesto Home loads
    Then the dashboard shows Goal Useful Find Rate and Time to First Useful Find from the Kernel snapshot
    And React does not recalculate either KPI from Missions, Evidence, Finds or feedback

  Scenario: A metric is not measurable yet
    Given Repeat Goal Usage has status not_measurable
    And its value is null
    When the scorecard is rendered
    Then the dashboard shows a truthful unavailable state
    And it does not render the metric as zero percent

  Scenario: The scorecard read fails while the Kernel remains reachable
    Given Cases, Goals, Missions and Finds remain readable
    And the product scorecard read fails
    When Overview refreshes
    Then the operational records remain visible
    And only the product scorecard is marked unavailable

  Scenario: A non-local scorecard is returned
    Given a response claims sourceOfTruth cloud
    Or the response enables external telemetry
    When the dashboard parses the scorecard
    Then the response is rejected fail-closed
    And no alternative metric truth is rendered

  Scenario: Mobile-width scorecard remains readable
    Given the dashboard is rendered at 390 by 844 CSS pixels
    When the product scorecard is visible
    Then the KPI grid reflows without horizontal overflow
    And the local-only privacy statement remains visible
