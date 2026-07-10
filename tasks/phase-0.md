# Phase 0 Task Plan - Minimum Kernel

Phase 0 builds the smallest useful version of Internet Brain OS.

Do not build the browser extension yet.
Do not build marketplace features yet.
Do not build advanced agents yet.
Do not require paid APIs.

## Goal

Build the local core loop:

```text
Objective -> Case -> Evidence -> Memory -> Obsidian notes -> Report
```

## Recommended implementation order

### Task 0.1 - Create technical skeleton

Create the initial monorepo structure.

Target structure:

```text
apps/
  extension/
  dashboard/
packages/
  kernel/
  obsidian/
  shared/
  skills/
  agents/
docs/
tasks/
prompts/
```

Minimum files:

- package manager config if using TypeScript.
- basic README files in empty folders.
- test setup if possible.

Acceptance criteria:

- Repo has a clear structure.
- No unnecessary dependencies.
- Project can be installed locally.

### Task 0.2 - Define shared domain types

Implement shared types for:

- Case.
- Evidence.
- Entity.
- Relationship.
- Report.
- Skill.
- LLM request/response.

Acceptance criteria:

- Types live in `packages/shared`.
- Types match `docs/architecture.md` unless justified.
- Types are exported cleanly.

### Task 0.3 - Implement Case Manager

Implement basic Case lifecycle:

- create case.
- list cases.
- read case.
- update case status.

Acceptance criteria:

- Works locally.
- Has basic tests.
- Does not require cloud.

### Task 0.4 - Implement Evidence Store

Implement evidence creation and retrieval.

Evidence must include:

- ID.
- Case ID.
- source URL when available.
- timestamp.
- raw text or summary.
- confidence when available.
- extraction method when available.

Acceptance criteria:

- Evidence is linked to a Case.
- Evidence can be listed by Case.
- Basic tests exist.

### Task 0.5 - Implement local storage

Choose simple local storage.

Preferred:

- JSON files for fastest prototype, or
- SQLite for more durable local storage.

Acceptance criteria:

- No hosted database required.
- Data path is configurable.
- Storage can be backed up by the user.

### Task 0.6 - Implement Obsidian exporter

Generate Markdown notes for:

- Case index.
- Evidence notes.
- Basic report.

Use YAML frontmatter.

Acceptance criteria:

- Output is valid Markdown.
- Output is readable without the app.
- Notes include backlinks where useful.

### Task 0.7 - Implement basic report generator

Generate a simple evidence-backed report from a Case.

Report sections:

- Objective.
- Summary.
- Key evidence.
- Hypotheses.
- Limitations.
- Next actions.

Acceptance criteria:

- Report references evidence IDs.
- Hypotheses are labeled as hypotheses.
- Limitations are visible.

### Task 0.8 - Implement minimal CLI

Create a local command interface.

Example commands:

```bash
ibo case create "Find suppliers for pet accessories in Europe"
ibo evidence add --case <id> --url <url> --text "..."
ibo export obsidian --case <id> --out ./vault
ibo report generate --case <id>
```

Acceptance criteria:

- User can complete core loop from terminal.
- No UI required yet.

### Task 0.9 - Add LLM adapter interface

Implement provider abstraction.

Minimum:

- Mock adapter.
- Ollama adapter placeholder or basic implementation.

Acceptance criteria:

- Core system can run without paid LLM.
- LLM output stores model name and timestamp when used.

### Task 0.10 - Add first basic Skill

Create a simple Skill that summarizes a webpage/text evidence item.

Acceptance criteria:

- Skill reads evidence.
- Skill writes summary/hypothesis output.
- Skill does not bypass evidence rules.

## Do not do in Phase 0

- No paid subscription system.
- No marketplace.
- No aggressive crawling.
- No spam automation.
- No cloud-only architecture.
- No complicated UI.
- No advanced browser overlay.
- No unsupported claims.

## Phase 0 review checklist

Before Phase 0 is considered complete:

- Can a user create a Case?
- Can a user add Evidence?
- Can the system export Obsidian notes?
- Can it generate a report?
- Can it work locally?
- Can it work without paid LLM APIs?
- Are decisions documented?
- Is handoff updated?
