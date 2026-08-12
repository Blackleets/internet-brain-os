import { describe, expect, it } from 'vitest';
import { checkConstitution } from './constitution-check.mjs';

describe('Efesto constitutional preflight', () => {
  it('requires the canonical constitution at every agent entry point', async () => {
    const result = await checkConstitution();

    expect(result.requiredEntryPoints).toEqual([
      'AGENTS.md',
      'README.md',
      'ARCHITECTURE.md',
      'PROJECT_STATE.md',
      'PROJECT_DNA.md',
      'PROJECT_BIBLE.md',
      'AGENT_ROLES.md',
      'LLM_HANDOFF.md',
      'docs/hermes-operating-protocol.md',
    ]);
  });
});
