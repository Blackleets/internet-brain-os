# Obsidian Memory Strategy

Obsidian is a first-class memory target for Internet Brain OS.

The goal is not just to export reports. The goal is to create a durable, human-readable, linked knowledge base.

## Why Obsidian matters

Obsidian gives the user:

- Ownership of data.
- Markdown portability.
- Backlinks.
- Graph view.
- Local-first knowledge.
- Long-term memory outside any single app.

## Vault structure

Recommended output structure:

```text
Internet Brain OS/
  Cases/
    <case-slug>/
      Index.md
      Report.md
      Evidence/
        <evidence-id>.md
      Notes/
        Hypotheses.md
        Open Questions.md
  Entities/
    Companies/
    People/
    Products/
    Suppliers/
    Competitors/
    Domains/
    Technologies/
    Markets/
  Reports/
  Daily Briefs/
  Templates/
```

## Case note template

```markdown
---
type: case
case_id: case_123
status: active
created_at: 2026-07-10
tags: [internet-brain-os, case]
---

# Case Title

## Objective

...

## Current status

...

## Key entities

- [[Company Name]]
- [[Product Name]]

## Evidence

- [[evd_123]]

## Hypotheses

- ...

## Next actions

- ...
```

## Evidence note template

```markdown
---
type: evidence
evidence_id: evd_123
case_id: case_123
source_url: https://example.com
captured_at: 2026-07-10T00:00:00Z
confidence: 0.82
---

# Evidence evd_123

## Source

https://example.com

## Extracted content

...

## Summary

...

## Limitations

...
```

## Entity note template

```markdown
---
type: entity
entity_type: company
entity_id: ent_123
aliases: []
evidence_ids: [evd_123]
---

# Company Name

## Summary

...

## Known relationships

- Supplier of [[Product Name]]
- Competitor of [[Other Company]]

## Evidence

- [[evd_123]]
```

## Required features

Phase 0 exporter should support:

- Case Index note.
- Evidence notes.
- Basic Report note.
- YAML frontmatter.
- Simple backlinks.

Later phases should support:

- Entity notes.
- Relationship notes.
- Daily briefs.
- Graph-enriched output.
- Automatic update of existing notes.

## Design rule

The Obsidian export must remain readable even without Internet Brain OS installed.
