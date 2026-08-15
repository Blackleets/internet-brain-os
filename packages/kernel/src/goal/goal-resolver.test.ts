import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebGoalResolver } from './goal-resolver';
import { UserGoal } from './user-goal-contract';

describe('WebGoalResolver', () => {
  let resolver: WebGoalResolver;
  let searcherMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    searcherMock = vi.fn<(query: string, limit?: number) => Promise<any>>();
    resolver = new WebGoalResolver(searcherMock as any);
  });

  it('should resolve a job goal and return candidates', async () => {
    const mockSearchResults = {
      query: 'test query',
      searchedAt: '2026-08-15T10:00:00.000Z',
      provider: 'duckduckgo-html',
      results: [
        {
          rank: 1,
          title: 'Trabajo de 20 horas - 600 euros mensuales',
          url: 'https://example.com/job1',
          snippet: 'Se busca trabajador para posición de 20 horas semanales con salario de 600 euros al mes.',
          sourceHost: 'example.com'
        },
        {
          rank: 2,
          title: 'Oportunidad de medio tiempo',
          url: 'https://example.com/job2',
          snippet: 'Trabajo medio tiempo con buen salario.',
          sourceHost: 'example.com'
        }
      ]
    };
    searcherMock.mockResolvedValue(mockSearchResults);

    const goalText = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const result = await resolver.resolve(goalText);

    // Check that we got candidates
    expect(Array.isArray(result.candidates)).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(0);

    // Check the first candidate
    const candidate = result.candidates[0];
    expect(candidate.title).toBe('Trabajo de 20 horas - 600 euros mensuales');
    expect(candidate.url).toBe('https://example.com/job1');
    expect(candidate.domain).toBe('example.com');
    expect(candidate.context).toBe('Se busca trabajador para posición de 20 horas semanales con salario de 600 euros al mes.');
    expect(candidate.retrievedAt).toBe('2026-08-15T10:00:00.000Z');
    expect(candidate.publishedAt).toBeNull(); // No date in snippet

    // Check criteria - should have detected hours and salary criteria
    expect(Array.isArray(candidate.criteriaMet)).toBe(true);
    expect(Array.isArray(candidate.criteriaMissing)).toBe(true);
    
    // Should have at least some criteria met (hours and/or salary)
    expect(candidate.criteriaMet.length).toBeGreaterThan(0);
    
    // Check coverage is a number between 0 and 1
    expect(typeof candidate.coverage).toBe('number');
    expect(candidate.coverage).toBeGreaterThanOrEqual(0);
    expect(candidate.coverage).toBeLessThanOrEqual(1);
    
    // Check state
    expect(candidate.state).toBe('partial'); // At least some criteria should be met
    
    // Check warnings exist
    expect(Array.isArray(candidate.warnings)).toBe(true);
    
    // Check that the searcher was called with queries from the plan
    expect(searcherMock).toHaveBeenCalled();
    
    // Overall resolution state should be partial since we have candidates with some criteria met
    expect(result.resolutionState).toBe('partial');
  });

  it('should handle no results scenario', async () => {
    // Mock empty results
    const emptySearchResults = {
      query: 'test query',
      searchedAt: '2026-08-15T10:00:00.000Z',
      provider: 'duckduckgo-html',
      results: []
    };
    searcherMock.mockResolvedValue(emptySearchResults);
    
    const goalText = 'Encuéntrame un trabajo de 20 horas que pague 600 euros al mes';
    const result = await resolver.resolve(goalText);

    // Should have no candidates
    expect(result.candidates.length).toBe(0);
    // Overall state should be no_match
    expect(result.resolutionState).toBe('no_match');
  });

  it('should extract dates from snippets when present', async () => {
    // Mock result with date in snippet
    const datedSearchResults = {
      query: 'test query',
      searchedAt: '2026-08-15T10:00:00.000Z',
      provider: 'duckduckgo-html',
      results: [
        {
          rank: 1,
          title: 'Trabajo publicado el 15/08/2026',
          url: 'https://example.com/job3',
          snippet: 'Publicado el 15/08/2026. Se busca trabajo de 20 horas.',
          sourceHost: 'example.com'
        }
      ]
    };
    searcherMock.mockResolvedValue(datedSearchResults);
    
    const goalText = 'Encuéntrame trabajo de 20 horas';
    const result = await resolver.resolve(goalText);
    
    const candidate = result.candidates[0];
    // Should have extracted the date and formatted as ISO
    expect(candidate.publishedAt).toBe('2026-08-15');
  });
});