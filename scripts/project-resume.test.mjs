import { describe, expect, it } from 'vitest';
import { renderProjectResume } from './project-resume.mjs';

describe('project continuity checkpoint', () => {
  it('combines the canonical checkpoint with live Git state', async () => {
    const output = await renderProjectResume();
    expect(output).toContain('HEPHAESTUS — Current Project State');
    expect(output).toContain('Authentic Hermes v0.19.0 runtime acceptance was proven');
    expect(output).toContain('Efesto MVP release readiness');
    expect(output).toContain('## Git live state');
    expect(output).toContain('Live Git/GitHub state overrides older checkpoint');
  });
});
