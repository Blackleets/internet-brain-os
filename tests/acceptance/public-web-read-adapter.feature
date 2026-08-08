Feature: Public web read capability
  Efesto may read public pages autonomously only through the controlled R0 execution boundary.

  Scenario: Authorized public page read
    Given the Goal allows capability "web.read" and data scope "public_web"
    And the current Proposed Plan requests version "1" of "web.read"
    And the public web connector is healthy
    When the Execution Engine invokes the connector with a public HTTPS URL
    Then the page is fetched through the SSRF-hardened WebPageFetcher
    And the bounded text result is returned through the Execution Record
    And the connector does not write Memory directly

  Scenario: Private network target remains blocked
    Given an authorized "web.read" execution
    When the URL resolves to a private or loopback address
    Then the WebPageFetcher rejects the request
    And the execution does not claim a successful read

  Scenario: Credential-bearing URL is rejected
    Given an authorized "web.read" execution
    When the requested URL contains embedded credentials
    Then the adapter rejects the payload before fetching

  Scenario: Exact read replay does not fetch twice
    Given a public page read completed under an idempotency key
    When the exact execution request is replayed
    Then the stored execution result is returned
    And the WebPageFetcher is not invoked again
