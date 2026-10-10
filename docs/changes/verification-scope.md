# Evidence verification scope — internal.94

## Current evidence and change

Mission verification persists Kernel-fetched Evidence and a SUPPORT decision based
on Goal term coverage. MissionEvidenceReader returns those stored decisions and
bounded verbatim excerpts. A `verified` fetch or `supported: true` does not certify
an exact price, current stock, publication date or shipping/eligibility condition.

Expose the implemented capability limits through an additive `verificationScope`
on the existing authenticated GET /api/agent-missions/:id/evidence response:

```json
{
  "topic": "term_coverage_only",
  "price": "not_assessed",
  "availability": "not_assessed",
  "freshness": "not_assessed"
}
```

These are implementation limits, not per-Find judgments or inferred Goal requirements.
They are derived locally, never copied from an agent, page, verification row or
stored claimed scope. The client accepts omission from an older Kernel using the
same conservative limits. Explicit malformed or expanded certification is rejected
with MissionEvidenceContractError; absent scope cannot become certified conditions.

Each supported Forge card offers a collapsed native details disclosure stating
what SUPPORT covers and what remains unevaluated. It retains the source, excerpt,
Find action and SUPPORT state. The disclosure has a 44px summary, keyboard operation,
visible focus and wrapping on narrow screens; it makes no API mutation.

## Invariants and rollback

No admission, SUPPORT, authorization, source text, persisted record, memory, execution
or fetch rule changes. No new requests, provider, model or dependency. Keep schema
efesto.mission-evidence.v1 and all existing fields compatible. This scope concerns
the current Mission Evidence endpoint and Forge cards; other surfaces are not upgraded
to commercial verification by this change.

Rollback this commit's projection/client/disclosure only; no migration or user-data
rollback. The main risk is mistaking this visibility improvement for actual price
verification. Such verification is **not implemented** by internal.94.

## Verification

New backend/client regressions fail before implementation and pass after. Checks
cover stored spoofed scope, input immutability, legacy omission, malformed scope,
unsupported certification and the existing authenticated HTTP route. Component
coverage keeps the excerpt, Find action and unsupported state intact. Browser
acceptance at 390px and 1280px checks disclosure open/close using Enter, 44px summary,
unchanged SUPPORT and no horizontal overflow. Synthetic fixtures do not establish
commercial usefulness or founder-PC UAT.

## Next bounded contract: actual condition assessments (planned, not implemented)

An assessment must bind one explicit normalized constraint to Goal ID/revision,
Mission/attempt, source Evidence ID/hash, observation time and an exact quoted span
from the retained source. Source labels, snippets, the capture timestamp or agent
claims alone cannot satisfy it. Assess full retained Evidence, not a clipped UI excerpt.

Use `met`, `not_met`, `unknown` independently of topic SUPPORT. Missing, ambiguous,
conflicting or stale proof is unknown. A captured price is an observation at the
fetch time, never a guarantee that checkout will preserve it. No change to Find
admission or purchase authority is implicit in a condition assessment.

| Boundary | Required proof | Conservative result |
|---|---|---|
| Price | Amount, currency, correct product/variant and unit; explicit shipping/tax treatment when the Goal requires total cost | Unknown for unrelated numbers, list/starting prices, absent shipping, mixed currencies or rate/unit ambiguity |
| Availability | Explicit offer/stock or open-listing statement for the same item, region and observation | Unknown for a category page, generic delivery copy or unsupported seller assertion |
| Freshness | Explicit relevant publication/deadline time and timezone; bounded validity policy | Unknown when only capturedAt is known, a date is unrelated, timezone is ambiguous or policy has expired |
| Eligibility | Source conditions supporting requested location, remote access, skill or audience | Unknown when the source merely mentions the place or skill |

Future negative acceptance cases must include two products with different prices,
two currencies, discounted/list prices, shipping excluded, exact budget boundary,
an hourly rate versus project total, yesterday's deadline, absent publication date,
stock changed after capture, conflicting sources and edited Goal revisions. These
are planned requirements, not passing production checks. Adopt a separate versioned
assessment contract and additive rollout when implemented; don't repurpose supported
or the current not_assessed scope. Evaluate it against real-Goal-evaluation-v1.md.
