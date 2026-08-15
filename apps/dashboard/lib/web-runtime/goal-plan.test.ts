import { describe, expect, it } from 'vitest';
import { buildWebGoalPlan, prepareWebGoalPlan, WebPlanInputError } from './goal-plan';

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

  it('runs a bounded public search and preserves unverified result provenance', async () => {
    const plan = await prepareWebGoalPlan({ title: 'Encuéntrame un iPhone usado por menos de 1000 euros' }, {
      search: async (query) => ({
        query,
        searchedAt: '2026-08-15T10:00:00.000Z',
        provider: 'bing-html',
        results: [{ rank: 1, title: 'iPhone reacondicionado', url: 'https://example.com/iphone', snippet: 'Precio publicado por el vendedor.', sourceHost: 'example.com' }],
      }),
    });

    expect(plan).toMatchObject({ authority: 'web-runtime', readiness: 'ready', nextAction: 'confirm_goal' });
    expect(plan.sources[0]).toMatchObject({ id: 'public-web', status: 'ready' });
    expect(plan.publicSearch).toMatchObject({ status: 'ready', results: [{ title: 'iPhone reacondicionado' }] });
    expect(plan.limitations).toContain('preview_only');
  });

  it('shows provider unavailability instead of inventing results', async () => {
    const plan = await prepareWebGoalPlan({ title: 'Busca un producto' }, { search: async () => { throw new Error('provider down'); } });

    expect(plan.publicSearch).toMatchObject({ status: 'unavailable', provider: 'unavailable', results: [] });
    expect(plan.sources[0]).toMatchObject({ id: 'public-web', status: 'unavailable' });
    expect(plan.limitations).toContain('public_search_unavailable');
  });

  it('rejects empty or oversized goal input before doing any work', () => {
    expect(() => buildWebGoalPlan({ title: '  ' })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'x'.repeat(121) })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'Valid goal', keywords: new Array(13).fill('keyword') })).toThrow(WebPlanInputError);
  });
});
