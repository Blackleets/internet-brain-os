Feature: Launcher stop failures preserve recovery state
  Scenario: Windows rejects the owned Kernel stop request
    Given the launcher has verified its owned Kernel process
    When taskkill fails or times out
    Then the original launcher process record remains unchanged
    And shutdown reports failure rather than success
    And the CLI exits with an error

  Scenario: Pairing recovery cannot stop the existing Kernel
    Given pairing recovery requires a verified Kernel restart
    When the owned process stop request fails
    Then no replacement Kernel starts
    And recovery reports the failed stop

  Scenario: The Kernel still responds after the bounded stop wait
    Given a stop request was accepted
    When the shutdown wait ends with the Kernel still ready
    Then no replacement Kernel starts
    And repair reports unconfirmed shutdown

  Scenario: Windows accepts the owned Kernel stop request
    Given the launcher has verified its owned Kernel process
    When taskkill succeeds
    Then its launcher process record may be removed
    And the requested stop is reported without claiming unrelated processes were stopped
