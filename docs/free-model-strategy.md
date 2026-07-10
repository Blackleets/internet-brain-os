# Free Model Strategy

Internet Brain OS must be useful without expensive AI credits.

Paid models can improve quality, but they must not be required for the basic product.

## Model tiers

### Tier 0 - No LLM

The system should still support:

- Case creation.
- Evidence saving.
- Manual notes.
- Markdown export.
- Basic reports from templates.

### Tier 1 - Local small models

Use Ollama/local models for:

- Summaries.
- Tagging.
- Classification.
- Note drafting.
- Extraction cleanup.
- Basic question answering over saved text.

Examples:

- Llama small variants.
- Qwen small variants.
- Mistral small variants.
- Phi small variants.

Model choices can change over time.

### Tier 2 - Free/low-cost coding agents

Use OpenCode/Hermes for:

- Small implementation tasks.
- File creation.
- Local refactors.
- Tests.
- Documentation updates.

### Tier 3 - Strong paid models

Use stronger models only for high-value tasks:

- Architecture review.
- Complex reasoning.
- Security review.
- Major refactor planning.
- Deep synthesis.
- Critical bug diagnosis.

## Routing principle

Do not use a powerful expensive model for work a small local model can do.

## LLM adapter requirements

The code must support provider switching.

Minimum interface:

```ts
interface LLMAdapter {
  name: string;
  complete(input: LLMRequest): Promise<LLMResponse>;
}
```

## Offline mode

The system should eventually support offline/local use for:

- Viewing cases.
- Viewing evidence.
- Writing notes.
- Exporting to Obsidian.
- Running local models when installed.

## Prompt storage

Prompts should be versioned in the repo.

Suggested path:

```text
prompts/
  extraction.md
  summarization.md
  evidence-review.md
  report-generation.md
  handoff.md
```

## Quality strategy

Small models can be wrong.

Therefore:

- Keep evidence attached.
- Label uncertainty.
- Avoid unsupported claims.
- Allow human correction.
- Save model name and timestamp for AI outputs.
