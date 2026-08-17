import { describe, expect, it } from 'vitest';
import { WebGoalResolver } from './goal-resolver';
import type { PublicWebSearchResponse, PublicWebSearchResult } from '../execution/public-web-search-adapter';

function response(query: string, results: PublicWebSearchResult[]): PublicWebSearchResponse {
  return {
    query,
    searchedAt: '2026-08-15T10:00:00.000Z',
    provider: 'duckduckgo-html',
    results,
  };
}

describe('WebGoalResolver', () => {
  it('evaluates results returned by the authorized execution boundary', () => {
    const resolver = new WebGoalResolver();
    const goalText = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const query = resolver.plan(goalText).plan.queries[0];
    const result = resolver.resolve(goalText, [response(query, [
      {
        rank: 1,
        title: 'Trabajo de 20 horas - 600 euros mensuales',
        url: 'https://example.com/job1',
        snippet: 'Se busca trabajador para posición de 20 horas semanales con salario de 600 euros al mes.',
        sourceHost: 'example.com',
      },
      {
        rank: 2,
        title: 'Oportunidad de medio tiempo',
        url: 'https://example.com/job2',
        snippet: 'Trabajo medio tiempo con buen salario.',
        sourceHost: 'example.com',
      },
    ])]);

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({
      title: 'Trabajo de 20 horas - 600 euros mensuales',
      url: 'https://example.com/job1',
      domain: 'example.com',
      context: 'Se busca trabajador para posición de 20 horas semanales con salario de 600 euros al mes.',
      retrievedAt: '2026-08-15T10:00:00.000Z',
      publishedAt: null,
      state: 'partial',
    });
    expect(result.candidates[0].criteriaMet.length).toBeGreaterThan(0);
    expect(result.candidates[0].coverage).toBeGreaterThanOrEqual(0);
    expect(result.candidates[0].coverage).toBeLessThanOrEqual(1);
    expect(result.resolutionState).toBe('partial');
  });

  it('handles a no-results response without performing its own search', () => {
    const resolver = new WebGoalResolver();
    const goalText = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const query = resolver.plan(goalText).plan.queries[0];
    const result = resolver.resolve(goalText, [response(query, [])]);

    expect(result.candidates).toHaveLength(0);
    expect(result.resolutionState).toBe('no_match');
  });

  it('extracts dates from authorized result snippets', () => {
    const resolver = new WebGoalResolver();
    const goalText = 'Encuéntrame trabajo de 20 horas';
    const query = resolver.plan(goalText).plan.queries[0];
    const result = resolver.resolve(goalText, [response(query, [{
      rank: 1,
      title: 'Trabajo publicado el 15/08/2026',
      url: 'https://example.com/job3',
      snippet: 'Publicado el 15/08/2026. Se busca trabajo de 20 horas.',
      sourceHost: 'example.com',
    }])]);

    expect(result.candidates[0].publishedAt).toBe('2026-08-15');
  });

  it('returns finite zero coverage when the Goal has no criteria', () => {
    const resolver = new WebGoalResolver();
    const goalText = 'Encuéntrame trabajo remoto';
    const query = resolver.plan(goalText).plan.queries[0];
    const result = resolver.resolve(goalText, [response(query, [{
      rank: 1,
      title: 'Trabajo remoto',
      url: 'https://example.com/remote',
      snippet: 'Vacante de trabajo remoto.',
      sourceHost: 'example.com',
    }])]);

    expect(result.candidates[0].coverage).toBe(0);
    expect(Number.isFinite(result.candidates[0].coverage)).toBe(true);
  });
});
