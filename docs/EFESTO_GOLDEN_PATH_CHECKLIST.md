# Efesto Golden Path — Validation Checklist

This checklist is the pre-contact gate for the Efesto Validation Sprint v1.

## A. Clean installation

- [ ] A fresh checkout can install with `pnpm install --frozen-lockfile`.
- [ ] The normal launcher/installer path reaches a ready local Kernel.
- [ ] No provider credential, Kernel token, or Hermes secret is printed by the onboarding path.
- [ ] The MCP server can be launched by an external MCP client process.

## B. MCP handshake

- [ ] `initialize` completes with a supported MCP protocol version.
- [ ] `tools/list` exposes the intended read-only tools.
- [ ] Every exposed tool declares `readOnlyHint: true`.
- [ ] `kernel_status` reports truthful readiness without secrets.
- [ ] `list_goals` returns persisted Goals.
- [ ] `list_cases` returns persisted Cases.
- [ ] `get_case` returns a structured Case plus attached Evidence.

## C. Evidence/provenance comprehension

Use a real or representative Case containing Evidence and verify that a developer can identify:

- [ ] Case identity.
- [ ] Evidence identity.
- [ ] Source receipt/provenance.
- [ ] Canonical source URL.
- [ ] Capture timestamp.
- [ ] Content hash.
- [ ] Stored source material/summary.
- [ ] What is Evidence versus what is interpretation by the consuming agent/model.

The final comprehension test must be performed by someone who did not build the implementation. Founder explanation does not count as product comprehension.

## D. Golden Path

```text
Install
  → connect MCP
  → define/use one real Goal
  → authorized research
  → Case + Evidence
  → get_case
  → understand provenance
```

- [ ] No new feature is required to complete the path.
- [ ] The Goal is not limited to the historical drill/taladro example.
- [ ] The Case can be traced to its Evidence.
- [ ] Evidence remains distinguishable from model interpretation.
- [ ] A failed/missing Case produces a truthful structured error.
- [ ] Read-only MCP access cannot mutate Kernel authority or durable memory.

## E. External-builder readiness

- [ ] A developer can follow `docs/EFESTO_MCP_QUICKSTART.md` without reading the full architecture docs.
- [ ] The setup instructions match the current repository paths and environment names.
- [ ] The first successful interaction takes a bounded amount of time and has an observable result.
- [ ] We can hand the quickstart to a builder without a live founder walkthrough.

## F. Validation stop condition

Once A–E are green, stop product development for this path and begin external validation.

Do not add dashboards, integrations, tracking, new Kernel primitives, or vertical-specific features merely to improve the demo. Fix only a reproducible Golden Path blocker, onboarding defect, truthful-contract issue, or safety issue discovered during validation.
