Feature: Immutable packaged Windows installation qualification
  Efesto must prove that the exact internal ZIP produced by CI can be installed
  and repaired on supported Windows generations before anyone is asked to test it manually.

  Scenario: The packaged candidate installs from a path containing spaces
    Given CI produced one immutable internal Windows ZIP for the current commit
    And the ZIP checksum and BUILD_INFO match that commit
    When the candidate is extracted to a normal Windows path containing spaces
    And the installer runs from the extracted package
    Then Shared, Kernel and browser-extension runtimes are built from that package
    And the Kernel reports alive, owned and verified
    And the Hermes boundary reports ready
    And the desktop shortcut routes through Efesto Launcher.cmd

  Scenario: Repair is idempotent and preserves the private Kernel identity
    Given the exact packaged candidate completed its first installation
    And a private Kernel token already exists
    When the same packaged candidate runs repair again
    Then the repair succeeds
    And the private Kernel token digest is unchanged
    And the Kernel remains owned and verified

  Scenario: Installation output never exposes local credentials
    Given the qualification harness uses synthetic private runtime credentials
    When the packaged installer and repair paths execute
    Then neither the Kernel token nor the Hermes boundary credential appears in installer output

  Scenario: Public promotion remains blocked after automated qualification
    Given all packaged Windows qualification scenarios pass
    When release metadata is inspected
    Then publicLaunchApproved remains false
    And manual UAT remains a separate promotion gate
