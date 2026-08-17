import { describe, expect, it } from 'vitest';
import { buildPublicSearchQuery, buildWebGoalPlan, prepareWebGoalPlan, WebPlanInputError } from './goal-plan';

describe('web runtime goal preview', () => {
  it('builds a preview without claiming Kernel authority or connector access', () => {
    const plan = buildWebGoalPlan({
      title: 'Audita un repositorio de GitHub',
      now: () => '2026-08-14T12:00:00.000Z',
    });

    expect(plan).toMatchObject({
      schemaVersion: 'efesto.goal-intelligence.v1',
      authority: 'web-runtime',
      generatedAt: '2026-08-14T12:00:00.000Z',
      readiness: 'needs_setup',
      nextAction: 'configure_source',
    });
    expect(plan.sources.map((source) => source.id)).toEqual(['public-web', 'github']);
    expect(plan.sources.every((source) => source.status === 'not_configured')).toBe(true);
    expect(plan.limitations).toContain('preview_only');
  });

  it.each([
    ['software', 'Encuentra software de automatización'],
    ['open source', 'Encuentra proyectos open source de automatización'],
    ['documentos', 'Investiga documentos públicos sobre contratos'],
    ['notas', 'Busca notas públicas sobre trading'],
    ['eventos', 'Encuentra eventos de tecnología en Madrid'],
  ])('keeps generic %s Goals on public web only', (_label, title) => {
    const plan = buildWebGoalPlan({ title });

    expect(plan.sources.map((source) => source.id)).toEqual(['public-web']);
    expect(plan.intent.mode).toBe('public_research');
  });

  it('runs a bounded public search and preserves unverified result provenance', async () => {
    let searchedQuery = '';
    const plan = await prepareWebGoalPlan({ title: 'Encuéntrame un iPhone usado por menos de 1000 euros' }, {
      search: async (query) => {
        searchedQuery = query;
        return {
        query,
        searchedAt: '2026-08-15T10:00:00.000Z',
        provider: 'bing-html',
        results: [{ rank: 1, title: 'iPhone reacondicionado', url: 'https://example.com/iphone', snippet: 'Precio publicado por el vendedor.', sourceHost: 'example.com' }],
        };
      },
    });

    expect(plan).toMatchObject({ authority: 'web-runtime', readiness: 'ready', nextAction: 'confirm_goal' });
    expect(plan.sources[0]).toMatchObject({ id: 'public-web', status: 'ready' });
    expect(plan.publicSearch).toMatchObject({ status: 'ready', results: [{ title: 'iPhone reacondicionado' }] });
    expect(searchedQuery).toBe('iphone usado 1000 euros');
    expect(plan.limitations).toContain('preview_only');
  });

  it('searches the subject of a natural-language Goal instead of its command words', () => {
    expect(buildPublicSearchQuery('Explica qué es Bitcoin con fuentes públicas verificables.')).toBe('bitcoin');
    expect(buildPublicSearchQuery('Encuentra oportunidades de trabajo remoto en Madrid, 20 horas semanales, por 600 euros al mes.', [], ['job'])).toBe('trabajo remoto madrid empleo vacantes');
  });

  it('shows provider unavailability instead of inventing results', async () => {
    const plan = await prepareWebGoalPlan({ title: 'Busca un producto' }, { search: async () => { throw new Error('provider down'); } });

    expect(plan).toMatchObject({ readiness: 'unavailable', nextAction: 'configure_source' });
    expect(plan.publicSearch).toMatchObject({ status: 'unavailable', provider: 'unavailable', results: [] });
    expect(plan.sources[0]).toMatchObject({ id: 'public-web', status: 'unavailable' });
    expect(plan.limitations).toContain('public_search_unavailable');
  });

  it('does not report a connector-signaled Goal as ready when public search succeeds alone', async () => {
    const plan = await prepareWebGoalPlan({ title: 'Audita un repositorio de GitHub' }, {
      search: async (query) => ({
        query,
        searchedAt: '2026-08-15T10:00:00.000Z',
        provider: 'bing-html',
        results: [{ rank: 1, title: 'GitHub repository', url: 'https://example.com/repo', snippet: 'Repository result.', sourceHost: 'example.com' }],
      }),
    });

    expect(plan).toMatchObject({ readiness: 'needs_setup', nextAction: 'configure_source' });
    expect(plan.sources.find((source) => source.id === 'github')).toMatchObject({ status: 'not_configured', activeCapabilities: [] });
  });

  it('uses one bounded broad fallback when a focused job query has no matches', async () => {
    const queries: string[] = [];
    const plan = await prepareWebGoalPlan({ title: 'Encuentra oportunidades de trabajo remoto en Madrid, 20 horas semanales, por 600 euros al mes.' }, {
      search: async (query) => {
        queries.push(query);
        return {
          query,
          searchedAt: '2026-08-15T10:00:00.000Z',
          provider: 'bing-html',
          results: query === 'trabajo remoto madrid'
            ? [{ rank: 1, title: 'Trabajo remoto en Madrid', url: 'https://example.com/jobs', snippet: 'Empleo remoto y vacantes en Madrid.', sourceHost: 'example.com' }]
            : [],
        };
      },
    });

    expect(queries).toEqual(['trabajo remoto madrid empleo vacantes', 'trabajo remoto madrid']);
    expect(plan.publicSearch).toMatchObject({ query: 'trabajo remoto madrid', results: [{ title: 'Trabajo remoto en Madrid' }] });
  });

  it('rejects empty or oversized goal input before doing any work', () => {
    expect(() => buildWebGoalPlan({ title: '  ' })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'x'.repeat(121) })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'Valid goal', keywords: new Array(13).fill('keyword') })).toThrow(WebPlanInputError);
  });
});
