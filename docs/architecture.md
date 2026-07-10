# Architecture

Internet Brain OS should be built as a modular local-first system.

## High-level architecture

```text
Browser Extension / CLI / Dashboard
        |
        v
Local API / Kernel
        |
        +-- Case Manager
        +-- Evidence Store
        +-- Memory Store
        +-- Skill Runner
        +-- LLM Adapter
        +-- Obsidian Exporter
        +-- Report Generator
```

## Suggested initial stack

This can change later, but Phase 0 should prefer simple, maintainable tools.

Recommended:

- TypeScript.
- Node.js.
- pnpm workspaces.
- SQLite for local storage.
- Markdown files for Obsidian output.
- Playwright only when browser automation becomes necessary.
- Vitest for tests.

Alternative acceptable stack:

- Python for local-first backend and extraction.
- SQLite.
- FastAPI only if a local HTTP server is needed.

Do not mix stacks without a clear reason.

## Monorepo structure target

```text
apps/
  extension/
  dashboard/
  desktop/
packages/
  kernel/
  agents/
  skills/
  connectors/
  obsidian/
  shared/
docs/
tasks/
```

## Kernel responsibilities

The Kernel owns:

- Case lifecycle.
- Evidence registration.
- Memory writes.
- Skill execution.
- LLM provider abstraction.
- Export orchestration.
- Report generation.

The Kernel must not own:

- Browser UI details.
- Marketplace business logic.
- Vendor-specific LLM logic.
- Hardcoded Skills.

## Core data models

### Case

```ts
type Case = {
  id: string;
  title: string;
  objective: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  tags: string[];
};
```

### Evidence

```ts
type Evidence = {
  id: string;
  caseId: string;
  sourceUrl?: string;
  sourceTitle?: string;
  capturedAt: string;
  contentType: 'webpage' | 'text' | 'pdf' | 'image' | 'manual' | 'other';
  rawText?: string;
  summary?: string;
  confidence?: number;
  extractionMethod?: string;
  notes?: string;
};
```

### Entity

```ts
type Entity = {
  id: string;
  type: 'company' | 'person' | 'product' | 'supplier' | 'competitor' | 'domain' | 'technology' | 'document' | 'market' | 'other';
  name: string;
  aliases: string[];
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
};
```

### Relationship

```ts
type Relationship = {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  evidenceIds: string[];
  confidence?: number;
};
```

## LLM provider abstraction

Never hardcode a single model provider.

Use adapters:

```text
LLMAdapter
  -> OllamaAdapter
  -> OpenAIAdapter
  -> AnthropicAdapter
  -> LocalMockAdapter
```

Phase 0 must work with a mock adapter or Ollama.

## Evidence-first reporting

Reports must not contain unsupported major claims.

Each important statement should reference evidence IDs.

Example:

```markdown
The supplier appears to operate in Spain [evidence:evd_123].
```

## Future extension architecture

The extension should:

- Observe current page context.
- Capture public page metadata.
- Capture selected text when user requests it.
- Send a structured payload to the local Kernel.
- Show lightweight results.

The extension should not:

- Run heavy agents.
- Store long-term memory.
- Own core business logic.

## Development principle

Build the smallest coherent Kernel before building advanced surfaces.
