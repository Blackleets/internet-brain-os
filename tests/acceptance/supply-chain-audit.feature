Feature: Production supply-chain audit remains fail-closed
  Efesto must not weaken the production dependency gate to bypass a newly disclosed advisory.
  A temporary exception is allowed only for one reviewed GHSA when the stated compatible patched release is unavailable.

  Background:
    Given production dependencies are audited in CI
    And the Nano ID advisory is tracked by issue 145

  Scenario: Ignore only the reviewed Nano ID advisory
    Given GHSA-2v37-7h3g-55p8 affects the transitive dashboard dependency path
    And the advisory's compatible patched 3.x release is not yet published
    When the pnpm audit policy is evaluated
    Then GHSA-2v37-7h3g-55p8 may be ignored temporarily
    And no other advisory is ignored
    And the global audit severity is not reduced

  Scenario: A different production advisory appears
    Given GHSA-2v37-7h3g-55p8 is the only approved temporary exception
    When pnpm reports another production advisory
    Then CI must fail
    And that advisory must receive an independent security review

  Scenario: A compatible fixed Nano ID release becomes available
    Given a compatible non-vulnerable Nano ID release can satisfy the dashboard dependency path
    When the dependency and lockfile are upgraded
    Then the GHSA-2v37-7h3g-55p8 exception must be removed
    And pnpm audit --prod must pass without that exception
    And issue 145 may be closed only after the full repository verification gate passes
