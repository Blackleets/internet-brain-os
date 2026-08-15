import { describe, expect, it } from 'vitest';
import { EXTERNAL_INTEGRATION_DEFINITIONS } from './integration-definitions.mjs';

describe('shared external integration definitions', () => {
  it('keeps one bounded read-only contract per initial connector', () => {
    const ids = EXTERNAL_INTEGRATION_DEFINITIONS.map((definition) => definition.id);
    expect(ids).toEqual(['github', 'gmail', 'google-drive', 'notion', 'google-calendar']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const definition of EXTERNAL_INTEGRATION_DEFINITIONS) {
      expect(definition.adapter).toBe('mcp');
      expect(definition.readOnly).toBe(true);
      expect(definition.requiresExplicitConsent).toBe(true);
      expect(definition.scopes.length).toBeGreaterThan(0);
      expect(definition.capabilities.length).toBeGreaterThan(0);
      expect(definition.action).toBe('settings');
    }
  });
});
