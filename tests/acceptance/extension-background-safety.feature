Feature: Extension background runtime safety
  The browser extension must route commands exactly once and must not fail
  when the legacy public-page capture path is used.

  Scenario: Auto Radar toggle is handled exactly once
    Given the Efesto extension background service worker is running
    When the popup sends an EFESTO_AUTO_RADAR_TOGGLE command
    Then exactly one runtime message handler processes the command
    And exactly one toggle response is returned
    And the persisted Auto Radar state changes once

  Scenario: Legacy public-page capture has no popup-message dependency
    Given legacy radar capture is enabled for an explicitly allowed public origin
    And a valid local Kernel token is configured
    When the content script reports EFESTO_PUBLIC_PAGE_READY
    Then the page context is evaluated by the auto-capture policy
    And an allowed page is submitted exactly once to the local Kernel
    And the capture path does not depend on a popup-only message variable

  Scenario: Auto Radar state is reflected through the Chrome action API
    Given Auto Radar enters an observable state
    When the extension updates its toolbar action
    Then badge text is written with chrome.action.setBadgeText
    And badge background and title are updated without calling an unsupported action method
