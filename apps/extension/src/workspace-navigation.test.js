import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceView, workspaceVisibility } from './workspace-navigation.js';

describe('workspace navigation', () => {
  it('fails closed to the primary forge view', () => {
    expect(normalizeWorkspaceView('unknown')).toBe('forge');
    expect(normalizeWorkspaceView(undefined)).toBe('forge');
  });

  it('makes exactly one known view visible', () => {
    expect(workspaceVisibility('finds')).toEqual({ forge: false, missions: false, finds: true, models: false });
  });
});
