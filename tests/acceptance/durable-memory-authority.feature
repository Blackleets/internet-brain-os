Feature: Durable memory authority receipts
  Durable memory authority must survive restart without weakening replay or integrity guarantees.

  Scenario: Authority chain survives restart
    Given a valid memory authority transition has been durably appended
    When Efesto restarts
    Then the same receipt chain is reconstructed
    And the projected revision and authority state are unchanged

  Scenario: Exact replay after restart is safe
    Given a transition request was durably committed before restart
    When the exact normalized request is submitted after restart
    Then the original receipt is returned
    And no second receipt is appended

  Scenario: Altered replay after restart is blocked
    Given a requestId was durably bound to a transition before restart
    When the same requestId is reused with altered normalized content
    Then the Kernel rejects it as ALTERED_REPLAY
    And the durable history remains unchanged

  Scenario: Tampered durable history fails closed
    Given a durable authority receipt file exists
    When any integrity-bound receipt field is changed outside the Kernel
    Then startup reconstruction fails closed
    And no memory from that chain is reusable as trusted authority

  Scenario: Corrupt durable history fails closed
    Given the durable authority file is invalid JSON or has an unsupported schema
    When the Kernel loads authority history
    Then loading fails closed
    And no replacement authority state is invented

  Scenario: Persistence failure cannot create phantom authority
    Given the Kernel validates a proposed transition
    When durable persistence cannot complete atomically
    Then the transition is not observable as committed
    And a later restart contains no phantom receipt
