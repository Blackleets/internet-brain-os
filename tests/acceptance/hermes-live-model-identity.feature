Feature: Reviewed live model identity before authentic research acceptance
  The disposable runner must not execute Hermes with an unreviewed model artifact.

  Scenario: The explicit reviewed model can proceed to live qualification
    Given exactly one local model matches the configured explicit tag
    And its entire SHA-256 digest matches the reviewed registry manifest
    And its metadata advertises tool capability
    When live inference provisioning is verified
    Then the runner may proceed to authentic Hermes acceptance
    And provisioning alone does not prove Evidence, SUPPORT or a successful mission

  Scenario: A changed artifact with a matching short prefix is rejected
    Given the downloaded model shares the first 12 digest characters with the reviewed model
    But the full SHA-256 digest differs
    When live inference provisioning is verified
    Then provisioning fails before Hermes acceptance
    And the expected digest is not automatically updated

  Scenario: Ambiguous or incompatible metadata cannot grant readiness
    Given the expected model is missing, duplicated or lacks tool capability
    When live inference provisioning is verified
    Then provisioning fails before Hermes acceptance
    And user data and Kernel authority remain unchanged
