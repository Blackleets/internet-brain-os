import { describe, expect, it } from 'vitest';
import { renderProjectResume } from './project-resume.mjs';

describe('project continuity checkpoint', () => {
  it('combines the canonical checkpoint with live Git state', async () => {
    const output = await renderProjectResume();
    expect(output).toContain('HEPHAESTUS — Current Project State');
    expect(output).toContain('Issue #57');
    expect(output).toContain('## Git live state');
    expect(output).toContain('Live Git/GitHub state overrides older checkpoint');
  });
});
