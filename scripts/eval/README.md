# Offline bench: current ranking vs Jev (no product integration)

`pnpm eval:jev` compares Efesto's **current** candidate relevance/ranking path against
[Jev](https://docs.typesafe.ai/) (TypeSafe AI's typed-decision model) on labelled Goal/page
fixtures taken from this repo's tests.

This is an **offline evaluation harness only**:

- Jev is **not** integrated into the product. No file under `apps/**` or `packages/**` imports
  `scripts/eval/**` (enforced by `scripts/eval/eval-isolation-guard.test.mjs`).
- `packages/kernel/src/evidence/support.ts` is only **read** (transpiled in memory). It is never
  edited, wrapped or replaced.
- Without `--allow-network` **and** `JEV_API_KEY`, nothing leaves the machine. The run reports
  `jev: not run, no key` (or `--allow-network not given`). Jev scores are never faked, imputed or
  defaulted; a failed or malformed call is reported as such and left out of the metrics.
- Reports go to the git-ignored `.hephaestus/eval/` (`latest.json`, `latest.md` and timestamped copies).
- `publicLaunchApproved: false`.

## Run

```bash
pnpm eval:jev                      # current rankers only; Jev skipped (no key)
pnpm eval:jev --dataset my.jsonl   # add your own labelled cases (repeatable)
pnpm eval:jev --k 1,3,5 --out /tmp/bench
```

With a key (sends **fixture text only**; prints a privacy warning first):

```bash
export JEV_API_KEY=...             # never commit it; it is never written to the report
pnpm eval:jev --allow-network
```

| env | default | meaning |
|---|---|---|
| `JEV_API_KEY` | (none) | Bearer key. Without it Jev is skipped. |
| `JEV_BASE_URL` | `https://api.typesafe.ai` | Official TypeSafe. Use `https://ai-gateway.vercel.sh/typesafe` for Vercel AI Gateway (key = AI Gateway key), or `https://jevtypesafeai.com/api` for the third-party hosted route. |
| `JEV_DECIDE_PATH` | `/v1/systemone` (`/v1/decide` for jevtypesafeai.com) | Endpoint path. |
| `JEV_MODEL` | `jev-1.13.0` (`typesafe-ai/jev` on AI Gateway) | Pinned model. The resolved `model` from the response is recorded. |
| `JEV_PRICE_PER_MTOK_USD` | `0.042` on AI Gateway, otherwise unknown | Only used when the response carries no cost. |

Endpoint facts used (checked 2026-10-03): official `POST https://api.typesafe.ai/v1/systemone`
(docs.typesafe.ai/api); Vercel AI Gateway TypeSafe-compatible `POST https://ai-gateway.vercel.sh/typesafe/v1/systemone`
(vercel.com/docs/ai-gateway/sdks-and-apis/typesafe, list price $0.042 / 1M input tokens);
`jevtypesafeai.com` documents `POST https://jevtypesafeai.com/api/v1/decide` and calls itself a hosted
self-serve route, not TypeSafe's official API. Request body is the same everywhere:
`{ model, state, questions }`. Score answers are 0-indexed; budgets are 64k tokens (state + all
questions) and 32k (state + longest question); no streaming.

Jev questions asked per case (one call):

- `relevant` — `noul`: "This page provides evidence relevant to the Goal" (decision at ≥ 0.5).
- `relevance` — `score` with 5 levels (1 unrelated … 5 directly satisfies the Goal); reported as 1–5,
  normalised `(score−1)/4`, decision at ≥ 4.

State sent: `{ goal: { title, keywords }, page: { title, url, excerpt, text } }` from the fixture only.
Each state is checked against the token budget and `scripts/hermes-sensitive-data-scan-core.mjs`
before sending; flagged cases are skipped and reported.

## Rankers

| name | what it is |
|---|---|
| `current:kernel-support` | `evidenceSupportsGoal` (Kernel SUPPORT gate), hard 1/0. |
| `current:find-pipeline` | Mirrors `MissionSearchCandidateVerifier` → `projectVerifiedDocument` → `OpportunityProjector.list`: SUPPORT gate, `classifyOpportunity`, mission scope check, `rankOpportunity` (score 0–99, `/99` for Brier — **uncalibrated**). Pages that would not become a Kernel-supported Find score 0. |
| `jev:noul` / `jev:score` | The two Jev answers above (only when allowed). |

Metrics per ranker: precision@k and recall@k (expected value under random tie-breaking), decision
precision/recall/F1/accuracy, ROC-AUC (Mann-Whitney, ties = 0.5), Brier, ECE (5 bins), latency
(mean/p50/p95/max) and cost (local rankers $0; Jev from `usage.cost_usd`, AI Gateway
`provider_metadata.gateway.cost`, or tokens × price). Every metric is reported for **all cases** and for
the **non-circular** subset.

## Labelled dataset and provenance

`scripts/eval/fixtures/ranking-labelled-cases.jsonl` — **14 cases (7 relevant / 7 not relevant)**, all
from existing repo test assertions. **13 are circular**: the test asserts the current
`evidenceSupportsGoal` output (directly or through the verifier), so a perfect score for
`current:kernel-support` on them is a consistency check, not independent accuracy. **1 is
non-circular** (golden drill: the test stamps `supported` by hand and never calls the gate).

| case id | label | source test (file :: test) |
|---|---|---|
| support-c1-jwt-offtopic-unique-id | not relevant | `packages/kernel/test/support.test.ts` :: case 1 |
| support-c2-tesla-listed-on-topic | relevant | same file :: case 2 |
| support-c3a-bitcoin-negative-conclusion | relevant | same file :: case 3 (bitcoin) |
| support-c3b-openai-negative-conclusion | relevant | same file :: case 3 (OpenAI) |
| support-c4-tesla-unique-id-absent | not relevant | same file :: case 4 |
| support-c5-tesla-homepage-only | not relevant | same file :: case 5 |
| support-c6-chat-text-not-evidence | not relevant | same file :: case 6 |
| support-c7-agent-tool-claim-not-evidence | not relevant | same file :: case 7 |
| support-c9-empty-page | not relevant | same file :: case 9 (both assertions merged) |
| support-drill-offer-on-topic | relevant | same file :: on-topic drill offer evidence… |
| verifier-drill-offer-fetched-page | relevant | `apps/local-kernel/mission-search-candidate-verifier.test.mjs` :: uses fetched web.read content…; also `supported-find-notifier.test.mjs` and `agent-mission-executor.support-gate.test.mjs` |
| verifier-drill-offer-padded-13k | relevant | `mission-search-candidate-verifier.test.mjs` :: retains full fetched Evidence… |
| verifier-jwt-offtopic-unique-id | not relevant | `mission-search-candidate-verifier.test.mjs` (2 tests) and `supported-find-notifier.test.mjs` |
| golden-drill-18-25-eur-in-budget | relevant | `apps/local-kernel/golden-drill-goal.e2e.test.mjs` (non-circular) |

Each case's `provenance[].snippets` are verbatim strings that tests check still exist in the source
file, so a fixture that drifts from its source test fails CI.

Considered and **excluded** (no page text or not a Goal-relevance label): `opportunity-ranking.test.mjs`
(provenance/freshness ordering), `goals.test.mjs` `matchOpportunityToGoals` (opportunity metadata
only), `opportunity-classifier.test.mjs` (category, not Goal-conditioned), dashboard/extension
`supported` flags (already-decided data).

14 cases is far too few for stable numbers. To add cases, append JSONL lines following
`fixtures/ranking-labelled-case.schema.json` (enforced by `validateCase`), in a separate file passed
with `--dataset`, for example:

```json
{"schemaVersion":"efesto.eval.ranking-case.v1","id":"human-0001-drill-amazon-es","goal":{"title":"Find a good-quality drill in Spain for €18–€25","keywords":["drill","spain"]},"goalMode":"goal-manager","page":{"title":"…","url":"https://…","text":"…verbatim page text…"},"label":{"relevant":true,"graded":4},"labelSource":"human","labeledBy":"lewis","circular":false,"provenance":[{"file":"human","test":"manual review 2026-10","assertion":"page lists a drill at €22 from a reputable seller"}]}
```

Only add pages you are allowed to send to a third party if you plan to run Jev on them.
