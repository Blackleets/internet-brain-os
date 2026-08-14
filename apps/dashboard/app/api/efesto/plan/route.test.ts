import { describe, expect, it } from 'vitest';
import { GET, POST } from './route';

describe('web Goal preview route', () => {
  it('accepts bounded public Goal text without requiring a credential', async () => {
    const response = await POST(new Request('http://localhost/api/efesto/plan', {
      method: 'POST',
      body: JSON.stringify({ title: 'Busca trabajos freelance remotos' }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, authority: 'web-runtime', readiness: 'needs_setup' });
    expect(body.sources[0]).toMatchObject({ id: 'hermes', status: 'not_configured' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects oversized input and non-POST discovery', async () => {
    const oversized = await POST(new Request('http://localhost/api/efesto/plan', {
      method: 'POST',
      body: JSON.stringify({ title: 'x'.repeat(9_000) }),
    }));
    expect(oversized.status).toBe(413);

    const get = await GET();
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
  });
});
