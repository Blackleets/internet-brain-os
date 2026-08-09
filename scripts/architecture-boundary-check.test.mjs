import { describe, expect, it } from 'vitest';
import { inspectSource } from './architecture-boundary-check.mjs';

describe('architecture boundary guard', () => {
  it('allows provider-neutral Kernel dependencies', () => {
    const source = `
      import type { Claim } from '../claim/claim';
      import type { LLMRequest } from '@internet-brain-os/shared';
    `;

    expect(inspectSource(source)).toEqual([]);
  });

  it('does not reject unrelated package names that merely share a prefix', () => {
    expect(inspectSource(`import { helper } from 'openair-tools';`)).toEqual([]);
  });

  it('rejects provider SDK imports from protected authority code', () => {
    const source = `import OpenAI from 'openai';`;

    expect(inspectSource(source)).toEqual([
      expect.objectContaining({ specifier: 'openai' }),
    ]);
  });

  it('rejects side-effect-only provider imports', () => {
    const source = `import 'ollama/runtime';`;

    expect(inspectSource(source)).toEqual([
      expect.objectContaining({ specifier: 'ollama/runtime' }),
    ]);
  });

  it('rejects outward imports into app or connector implementations', () => {
    const source = `import { search } from '../../../packages/connectors/src/public-web-search';`;

    expect(inspectSource(source)).toEqual([
      expect.objectContaining({ specifier: '../../../packages/connectors/src/public-web-search' }),
    ]);
  });

  it('rejects dynamic provider imports as well as static imports', () => {
    const source = `const provider = await import('@anthropic-ai/sdk');`;

    expect(inspectSource(source)).toEqual([
      expect.objectContaining({ specifier: '@anthropic-ai/sdk' }),
    ]);
  });
});
