import { describe, expect, it } from 'vitest';
import { GET, postGoalPlan } from './route';

describe('web Goal preview route', () => {
  it('accepts bounded public Goal text without requiring a credential', async () => {
    const response = await postGoalPlan(new Request('http://localhost/api/efesto/plan', {
      method: 'POST',
      body: JSON.stringify({ title: 'Busca trabajos freelance remotos' }),
    }), {
      search: async (query) => ({
        query,
        searchedAt: '2026-08-15T10:00:00.000Z',
        provider: 'bing-html',
        results: [{ rank: 1, title: 'Resultado público', url: 'https://example.com/result', snippet: 'Fuente pública de prueba.', sourceHost: 'example.com' }],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, authority: 'web-runtime', readiness: 'ready' });
    expect(body.sources[0]).toMatchObject({ id: 'public-web', status: 'ready', activeCapabilities: ['web.search', 'public.read'] });
    expect(body.publicSearch).toMatchObject({ status: 'ready', provider: 'bing-html', results: [{ url: 'https://example.com/result' }] });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects oversized input and non-POST discovery', async () => {
    const oversized = await postGoalPlan(new Request('http://localhost/api/efesto/plan', {
      method: 'POST',
      body: JSON.stringify({ title: 'x'.repeat(9_000) }),
    }), { search: async () => { throw new Error('search should not run'); } });
    expect(oversized.status).toBe(413);

    const get = await GET();
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
  });
});
