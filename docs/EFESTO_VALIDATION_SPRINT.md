# Efesto Validation Sprint v1

**Status:** Active validation plan  
**Purpose:** Validate the Efesto thesis with real agent builders without changing Efesto's product identity or turning the Kernel into a vertical application.

## 1. Product thesis

Efesto / Hephaestus is a local-first intelligence Kernel that controls how agent-produced information moves from observation to evidence, interpretation, validation and—only when explicitly authorized—durable memory.

The validation question is not whether a crypto-specific tool is useful. The question is whether builders of autonomous research agents obtain meaningful value from a system that preserves provenance and keeps evidence, interpretation and memory authority distinct.

### Non-negotiable identity

- Efesto remains the infrastructure and product experience around the Kernel.
- A beachhead is a validation audience, not a new vertical product.
- The Kernel remains the authority for Evidence, validation, contradiction handling, replay and durable-memory admission.
- Agents remain external discoverers/researchers/proposers; an agent is never the Kernel.
- No new domain-specific product is created solely for this sprint.

## 2. Beachhead user

The first validation audience is:

> **Indie developers/builders who already build autonomous research agents** using LangChain, CrewAI, Claude/GPT, MCP and/or their own tools.

Typical projects include research agents, scrapers, opportunity finders, monitoring agents and RAG/memory-based workflows.

Preferred distribution communities:

- X / AI-agent builder community
- r/AI_Agents
- r/LocalLLaMA
- MCP and AI-engineering Discord communities
- Hacker News / Show HN

This is intentionally self-serve and non-enterprise. The first experiment must not depend on enterprise procurement or a long sales cycle.

## 3. Problem hypothesis

The builder's agent can produce a conclusion, but the builder cannot reliably distinguish:

1. what was actually observed;
2. what the model inferred or interpreted;
3. what evidence supports the conclusion;
4. what, if anything, is safe to retain as durable memory.

The risk compounds when agent output enters RAG or memory: an unsupported model statement can become a future "fact" and influence later executions.

## 4. Existing Efesto capability under test

The sprint deliberately uses the existing read-only MCP surface rather than introducing a new product architecture.

Current MCP tools:

- `kernel_status`
- `list_goals`
- `list_missions`
- `list_cases`
- `get_case`

These expose Kernel state, Cases and Evidence receipts/provenance to an MCP client such as Claude Desktop, Cursor, Windsurf or Hermes.

The critical product test is whether a builder can connect their client, run a real Goal, inspect a Case through `get_case`, and understand the distinction between Evidence and interpretation without a long founder-led explanation.

## 5. Golden Path under validation

```text
Install Efesto
  ↓
Connect MCP client
  ↓
Define one real Goal from the builder's own project
  ↓
Run authorized research
  ↓
Create Case with Evidence
  ↓
Inspect Case through get_case
  ↓
Observe provenance + Evidence / interpretation distinction
  ↓
Builder understands the value without founder explanation
```

The existing canonical economic Goal may remain a development fixture, but it is **not** the validation success case. Validation requires at least one real Goal supplied by the external builder.

## 6. Distribution experiment

Target: **15–20 carefully selected builders**.

Order of operations:

1. Publish an X post/thread with a short real-world agent failure and a ~30-second Efesto demonstration.
2. Send 15–20 personalized DMs to builders who already discuss agent hallucination, provenance, memory or trust problems.
3. Publish the same core demonstration to relevant technical communities, including Show HN / r/AI_Agents where appropriate.
4. Submit/list the existing MCP server in an appropriate MCP directory/registry when the listing is ready.

No paid advertising during the sprint.

### Distribution message

The message should lead with the problem, not the architecture:

> **Your agent said it. Does that mean it's true?**

Then demonstrate that Efesto preserves the path from what was observed to what was interpreted and what the Kernel is willing to treat as trusted knowledge.

Do not market the sprint as a crypto scanner, trading tool or vertical intelligence product.

## 7. Signal ladder

Signals are intentionally separated by strength:

| Level | Signal | Interpretation |
|---|---|---|
| 0 | "Cool" / like / comment | Curiosity only |
| 1 | Installs Efesto | Technical curiosity |
| 2 | Runs a real Goal | Initial product engagement |
| 3 | Returns for a second run | Stronger value signal |
| 4 | Asks to connect/integrate their own agent | Strong integration signal |
| 5 | Describes a concrete trust/provenance/memory pain | Strong problem validation |
| 6 | Asks about price, API or paid access | Commercial signal |

The strongest signals are repeat use, integration intent and explicit articulation of the problem—not engagement metrics.

## 8. Success / failure criteria

### Distribution checkpoint

For 20 targeted contacts:

- **≥5 responses:** message is generating meaningful interest.
- **≥3 real trials:** sufficient initial product curiosity.
- **≥2 real Goals executed:** enough activity to inspect product behavior.

These are directional thresholds, not claims about market conversion rates.

### Product checkpoint

Among builders who execute a real Goal, strong evidence includes:

- at least one spontaneous return;
- at least one attempt/request to integrate Efesto with their own agent/framework;
- explicit recognition that provenance/evidence/memory authority solves a problem they already experience;
- at least one pricing/API/availability question.

### Hypothesis challenge

The thesis must be reconsidered if real builders repeatedly complete the workflow but:

- do not perceive a meaningful difference between Efesto and their existing workflow;
- do not identify evidence/provenance/memory trust as a real problem;
- do not return or seek integration;
- show only generic curiosity without problem-specific value.

A poor DM response rate alone does **not** invalidate the technical/product thesis; it invalidates or weakens the distribution message/list and requires a distribution adjustment first.

## 9. Time and resource constraint

- Duration: **3–4 weeks**.
- Paid acquisition: **€0**.
- The sprint must not cannibalize existing income-producing work.
- No feature expansion merely to create the appearance of progress.

### Change budget

Only make code changes when they are required to:

1. unblock the Golden Path;
2. remove a reproducible onboarding defect;
3. make an existing Kernel/MCP contract truthful or understandable;
4. instrument already-local validation observations without introducing central telemetry or new authority.

Do not build new vertical features, speculative integrations or large refactors during this sprint.

## 10. Repository guardrails

This validation plan does **not** authorize:

- changing `main` directly;
- weakening Kernel authority boundaries;
- making agents authoritative over Evidence or memory;
- adding central telemetry or hidden user tracking;
- converting the beachhead into Efesto's product identity;
- deleting durable architecture/invariant documentation merely to reduce file count.

Historical/duplicate process documentation can be archived separately after review. Canonical architecture, constitution, safety and authority contracts remain protected.

## 11. First execution checklist

- [ ] Verify current MCP Golden Path on a clean environment.
- [ ] Verify `kernel_status`, `list_goals`, `list_cases`, and `get_case` with a real Case.
- [ ] Verify that the Case response makes provenance and Evidence/interpretation distinction understandable without hidden UI assumptions.
- [ ] Prepare the 30-second demo.
- [ ] Publish the X launch post/thread.
- [ ] Build a list of 15–20 qualified builders.
- [ ] Send personalized outreach.
- [ ] Record only the minimum local validation observations needed for the sprint.
- [ ] Review signals weekly.
- [ ] At week 3–4, make an explicit continue / modify / stop decision.

## 12. Decision rule

At the end of the sprint, choose exactly one:

**CONTINUE** — strong repeat/integration/problem signals; proceed to productization around the validated workflow without changing the core thesis.

**MODIFY** — the problem appears real but the Golden Path, audience or distribution message is wrong; make the smallest evidence-driven adjustment and run a new bounded experiment.

**STOP** — real builders can complete the workflow but consistently find no meaningful value in evidence/provenance/memory authority; pause the thesis rather than extending the experiment because of sunk cost.

---

**North Star:** Efesto is the trust/control layer for intelligence produced by agents. The validation beachhead exists to test that thesis—not to replace it.
