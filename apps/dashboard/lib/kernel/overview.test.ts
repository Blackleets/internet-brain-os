import { describe, expect, it, vi } from 'vitest';
import { KernelClient } from './client';
import { loadOverview } from './overview';
import {
  bootstrapResponse,
  casesResponse,
  goalsResponse,
  healthResponse,
  missionsResponse,
  modelForgeResponse,
  opportunitiesResponse,
  preferencesResponse,
  statusResponse,
} from '../../test/fixtures';

const responses = {
  '/health': healthResponse,
  '/status': statusResponse,
  '/bootstrap/status': bootstrapResponse,
  '/api/cases': casesResponse,
  '/api/goals': goalsResponse,
  '/api/agent-missions': missionsResponse,
  '/api/opportunities': opportunitiesResponse,
  '/api/model-forge': modelForgeResponse,
  '/api/preferences': preferencesResponse,
};

function clientWith(overrides: Partial<Record<keyof typeof responses, Response>> = {}) {
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(input.toString()).pathname as keyof typeof responses;
    return overrides[path] ?? Response.json(responses[path]);
  };

  return new KernelClient({ baseUrl: 'http://localhost:4000', token: 'local-token', fetcher });
}

describe('loadOverview', () => {
  it('composes a complete truthful snapshot from persisted Kernel records', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T11:00:00.000Z'));

    try {
      const snapshot = await loadOverview(clientWith());

      expect(snapshot.readiness.kernel).toBe('online');
      expect(snapshot.readiness.modelForge).toMatchObject({ runtime: 'available', recommended: 'qwen3:4b' });
      expect(snapshot.metrics).toEqual({ cases: 1, goals: 1, missions: 1, activeMissions: 1, opportunities: 1 });
      expect(snapshot.productScorecard).toMatchObject({
        sourceOfTruth: 'local_kernel',
        privacy: { mode: 'local_only', externalTelemetry: false },
        primary: { goalUsefulFindRate: { status: 'measured', value: 0.5 } },
      });
      expect(snapshot.missions).toMatchObject([{ id: 'mission-1', status: 'running' }]);
      expect(snapshot.opportunities).toMatchObject([{ id: 'opportunity-1', status: 'new' }]);
      expect(snapshot.activity).toEqual([
        { id: 'goal:goal-1', recordId: 'goal-1', kind: 'goal', timestamp: '2026-07-26T10:00:00.000Z', state: 'active' },
        { id: 'mission:mission-1', recordId: 'mission-1', kind: 'mission', timestamp: '2026-07-26T10:00:00.000Z', state: 'investigating' },
        { id: 'opportunity:opportunity-1', recordId: 'opportunity-1', kind: 'opportunity', timestamp: '2026-07-26T10:00:00.000Z', state: 'new' },
      ]);
      expect(snapshot.loadedAt).toBe('2026-07-26T11:00:00.000Z');
      expect(snapshot.issues).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps successful records visible when optional read models are unavailable', async () => {
    const snapshot = await loadOverview(clientWith({
      '/api/model-forge': new Response(null, { status: 404 }),
      '/api/preferences': new Response(null, { status: 404 }),
    }));

    expect(snapshot.metrics).toEqual({ cases: 1, goals: 1, missions: 1, activeMissions: 1, opportunities: 1 });
    expect(snapshot.missions).toHaveLength(1);
    expect(snapshot.opportunities).toHaveLength(1);
    expect(snapshot.readiness.modelForge).toBeUndefined();
    expect(snapshot.productScorecard).toBeUndefined();
    expect(snapshot.issues).toEqual(expect.arrayContaining([
      { endpoint: 'modelForge', code: 'UNAVAILABLE' },
      { endpoint: 'scorecard', code: 'UNAVAILABLE' },
    ]));
  });

  it('counts a persisted mission waiting for an agent as active', async () => {
    const snapshot = await loadOverview(clientWith({
      '/api/agent-missions': Response.json({
        ok: true,
        missions: [{
          id: 'mission-waiting',
          goalId: 'goal-1',
          status: 'waiting_for_agent',
          attempt: 0,
          createdAt: '2026-07-26T10:03:00.000Z',
        }],
      }),
    }));

    expect(snapshot.metrics.activeMissions).toBe(1);
    expect(snapshot.activity).toContainEqual({
      id: 'mission:mission-waiting',
      recordId: 'mission-waiting',
      kind: 'mission',
      timestamp: '2026-07-26T10:03:00.000Z',
      state: 'waiting_for_agent',
    });
  });

  it('does not label completed-without-forged mission activity as Completado', async () => {
    const snapshot = await loadOverview(clientWith({
      '/api/agent-missions': Response.json({
        ok: true,
        missions: [
          {
            id: 'mission-bare-completed',
            goalId: 'goal-1',
            status: 'completed',
            attempt: 1,
            createdAt: '2026-07-26T10:03:00.000Z',
          },
          {
            id: 'mission-forged',
            goalId: 'goal-1',
            status: 'completed',
            executionPhase: 'forged',
            attempt: 1,
            createdAt: '2026-07-26T10:04:00.000Z',
          },
        ],
      }),
    }));

    expect(snapshot.activity).toContainEqual({
      id: 'mission:mission-bare-completed',
      recordId: 'mission-bare-completed',
      kind: 'mission',
      timestamp: '2026-07-26T10:03:00.000Z',
      state: 'completed_without_forge',
    });
    expect(snapshot.activity).toContainEqual({
      id: 'mission:mission-forged',
      recordId: 'mission-forged',
      kind: 'mission',
      timestamp: '2026-07-26T10:04:00.000Z',
      state: 'forged',
    });
    expect(snapshot.activity.some((entry) => entry.kind === 'mission' && entry.state === 'completed')).toBe(false);
  });

  it('retains server failures as HTTP_ERROR instead of optional unavailability', async () => {
    const snapshot = await loadOverview(clientWith({
      '/api/model-forge': new Response(null, { status: 500 }),
      '/api/preferences': new Response(null, { status: 500 }),
    }));

    expect(snapshot.issues).toContainEqual({ endpoint: 'modelForge', code: 'HTTP_ERROR' });
    expect(snapshot.issues).toContainEqual({ endpoint: 'scorecard', code: 'HTTP_ERROR' });
    expect(snapshot.issues).not.toContainEqual({ endpoint: 'scorecard', code: 'UNAVAILABLE' });
  });

  it('does not initiate protected reads when health proves the Kernel is offline', async () => {
    const invoked: string[] = [];
    const client = new KernelClient({
      baseUrl: 'http://localhost:4000',
      token: 'local-token',
      fetcher: async (input) => {
        const path = new URL(input.toString()).pathname;
        invoked.push(path);
        if (path === '/health') throw new Error('connection refused');
        return Response.json(responses[path as keyof typeof responses]);
      },
    });

    const snapshot = await loadOverview(client);

    expect(snapshot.readiness.kernel).toBe('offline');
    expect(snapshot.issues).toContainEqual({ endpoint: 'health', code: 'OFFLINE' });
    expect(snapshot.issues).toEqual(expect.arrayContaining([
      { endpoint: 'cases', code: 'UNAVAILABLE' },
      { endpoint: 'goals', code: 'UNAVAILABLE' },
      { endpoint: 'missions', code: 'UNAVAILABLE' },
      { endpoint: 'opportunities', code: 'UNAVAILABLE' },
      { endpoint: 'activity', code: 'UNAVAILABLE' },
      { endpoint: 'scorecard', code: 'UNAVAILABLE' },
    ]));
    expect(invoked).toEqual(expect.arrayContaining(['/health', '/status', '/bootstrap/status']));
    expect(invoked.filter((path) => path.startsWith('/api/'))).toEqual([]);
  });

  it('keeps protected reads parallel when health failure is ambiguous', async () => {
    const invoked: string[] = [];
    const client = new KernelClient({
      baseUrl: 'http://localhost:4000',
      token: 'local-token',
      fetcher: async (input) => {
        const path = new URL(input.toString()).pathname;
        invoked.push(path);
        if (path === '/health') return new Response(null, { status: 500 });
        return Response.json(responses[path as keyof typeof responses]);
      },
    });

    const snapshot = await loadOverview(client);

    expect(snapshot.readiness.kernel).toBe('offline');
    expect(snapshot.issues).toContainEqual({ endpoint: 'health', code: 'HTTP_ERROR' });
    expect(invoked.filter((path) => path.startsWith('/api/'))).toEqual([
      '/api/cases',
      '/api/goals',
      '/api/agent-missions',
      '/api/opportunities',
      '/api/model-forge',
      '/api/preferences',
    ]);
  });

  it('orders equal persisted timestamps by stable derived activity ID', async () => {
    const first = await loadOverview(clientWith());
    const second = await loadOverview(clientWith());

    expect(first.activity).toEqual(second.activity);
    expect(first.activity.map((entry) => entry.id)).toEqual([
      'goal:goal-1',
      'mission:mission-1',
      'opportunity:opportunity-1',
    ]);
  });

  it('uses code-unit ordering for equal activity timestamps', async () => {
    const snapshot = await loadOverview(clientWith({
      '/api/goals': Response.json({
        ok: true,
        goals: [
          { id: 'é', title: 'Accent', priority: 1, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' },
          { id: 'z', title: 'ASCII', priority: 1, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' },
        ],
      }),
      '/api/agent-missions': Response.json({ ok: true, missions: [] }),
      '/api/opportunities': Response.json({ ok: true, opportunities: [] }),
    }));

    expect(snapshot.activity.map((entry) => entry.id)).toEqual(['goal:z', 'goal:é']);
  });
});