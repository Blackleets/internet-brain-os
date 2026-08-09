Feature: Immutable packaged Windows installation qualification
  Efesto must prove that the exact internal ZIP produced by CI can complete a real
  first install and a safe repair before anyone is asked to test it manually.

  Scenario: The exact package completes a fresh unpaired installation
    Given CI produced one immutable internal Windows ZIP for the current commit
    And the ZIP checksum and BUILD_INFO match that commit
    When the candidate is extracted to a normal Windows path containing spaces
    And the installer runs with no prior Kernel token or authorized extension identity
    Then Shared, Kernel and browser-extension runtimes are built from that package
    And a private Kernel token is created locally
    And the Kernel reports alive, owned and verified
    And the Hermes boundary reports ready
    And browser pairing is truthfully reported as required
    And the desktop shortcut routes through Efesto Launcher.cmd

  Scenario: A paired repair is idempotent and preserves local identity
    Given the exact packaged candidate completed its fresh installation
    And the owned Kernel is shut down safely
    And a synthetic internal Chrome extension identity is authorized locally
    When the same packaged candidate runs repair again
    Then the repair succeeds
    And the private Kernel token digest is unchanged
    And the Kernel remains owned and verified
    And browser pairing is reported as paired

  Scenario: Captured repair output never exposes local credentials
    Given the paired repair uses synthetic private runtime credentials
    When the packaged repair path executes with stdout and stderr captured
    Then neither the private Kernel token nor the Hermes boundary credential appears in captured repair output

  Scenario: Public promotion remains blocked after automated qualification
    Given all packaged Windows qualification scenarios pass
    When release metadata is inspected
    Then publicLaunchApproved remains false
    And manual UAT remains a separate promotion gate
