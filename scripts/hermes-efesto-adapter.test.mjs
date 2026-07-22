import { describe, expect, it } from 'vitest';
import { buildHermesArgs, buildHermesPrompt, parseHermesFindings } from './hermes-efesto-adapter.mjs';

describe('Hermes Efesto adapter', () => {
  it('builds a bounded public research prompt from an authorized mission', () => {
    const prompt = buildHermesPrompt({
      schemaVersion: 'efesto.hermes-mission.v1',
      mission: { id: 'mission-1', goalTitle: 'Find grants in Madrid', cadence: 'once', scope: { categories: ['funding'], keywords: ['grant'], location: 'Madrid' } },
    });
    expect(prompt).toContain('Return ONLY one valid JSON object');
    expect(prompt).toContain('Find grants in Madrid');
    expect(prompt).toContain('public-source research mission');
  });

  it('uses the Hermes v0.19 scripted one-shot CLI contract', () => {
    const prompt = 'Return JSON only';
    expect(buildHermesArgs(prompt)).toEqual(['-z', prompt]);
  });

  it('accepts strict JSON and bounded findings', () => {
    expect(parseHermesFindings('{"findings":[{"url":"https://example.com/a","title":"A","text":"Public evidence","summary":"Summary"}]}')).toEqual({
      findings: [{ url: 'https://example.com/a', title: 'A', text: 'Public evidence', summary: 'Summary' }],
    });
  });

  it('accepts one JSON code fence but strips it before parsing', () => {
    expect(parseHermesFindings('```json\n{"findings":[]}\n```')).toEqual({ findings: [] });
  });

  it('rejects authority or unsupported fields', () => {
    expect(() => parseHermesFindings('{"findings":[{"url":"https://example.com","title":"A","text":"B","admitted":true}]}')).toThrow('unsupported field');
  });

  it('rejects invalid schemas and oversized result batches', () => {
    expect(() => buildHermesPrompt({ schemaVersion: 'wrong', mission: {} })).toThrow('efesto.hermes-mission.v1');
    expect(() => parseHermesFindings(JSON.stringify({ findings: Array.from({ length: 21 }, () => ({})) }))).toThrow('at most 20');
  });
});
