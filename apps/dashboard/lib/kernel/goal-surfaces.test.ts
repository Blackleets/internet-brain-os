import { describe, expect, it, vi } from 'vitest';
import { KernelClient, KernelClientError } from './client';
import {
  GOAL_SURFACE_SCHEMA_VERSION,
  GoalSurfaceContractError,
  loadGoalSurface,
  loadGoalSurfaces,
  parseGoalSurface,
  parseGoalSurfaces,
} from './goal-surfaces';

function surface(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
    sourceOfTruth: 'kernel',
    observedAt: '2026-08-09T17:10:00.000Z',
    goal: {
      id: 'goal:1',
      title: 'Find a quality drill',
      status: 'active',
      revision: 1,
      createdAt: '2026-08-09T16:00:00.000Z',
      updatedAt: '2026-08-09T16:00:00.000Z',
      compatibility: 'legacy_radar',
      policySummary: {
        autonomyLevel: 'assisted',
        approvalPolicy: 'none',
        source: 'legacy_compatibility',
      },
    },
    mission: {
      id: 'mission:1',
      status: 'running',
      executionPhase: 'investigating',
      workState: 'investigating',
      createdAt: '2026-08-09T16:10:00.000Z',
      updatedAt: '2026-08-09T16:20:00.000Z',
      attempt: 1,
      findCount: 2,
    },
    ...overrides,
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('dashboard Shared Goal Truth client boundary', () => {
  it('parses the Kernel-owned list without collapsing Goal and Mission state', () => {
    const parsed = parseGoalSurfaces({ ok: true, surfaces: [surface()] });
    expect(parsed[0]).toMatchObject({
      schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
      sourceOfTruth: 'kernel',
      goal: { id: 'goal:1', status: 'active', compatibility: 'legacy_radar' },
      mission: { status: 'running', executionPhase: 'investigating', workState: 'investigating', findCount: 2 },
    });
    expect(parsed[0].goal.status).toBe('active');
    expect(parsed[0].mission?.workState).toBe('investigating');
  });

  it('preserves Kernel policy blocks so the UI cannot invent queued progress', () => {
    const blocked = surface({
      mission: {
        ...surface().mission,
        status: 'failed',
        executionPhase: 'failed',
        workState: 'failed',
        blockedReason: 'automatic_r0_policy_denied',
      },
    });
    expect(parseGoalSurfaces({ ok: true, surfaces: [blocked] })[0].mission).toMatchObject({
      workState: 'failed',
      blockedReason: 'automatic_r0_policy_denied',
    });
  });

  it('parses one exact surface and preserves UniversalGoal policy labelling', () => {
    const canonical = surface({
      goal: {
        id: 'goal:v2',
        title: 'Monitor remote work',
        status: 'paused',
        revision: 4,
        createdAt: '2026-08-09T14:00:00.000Z',
        updatedAt: '2026-08-09T16:00:00.000Z',
        compatibility: 'universal_v2',
        policySummary: {
          autonomyLevel: 'semi_autonomous',
          approvalPolicy: 'checkpoints',
          source: 'goal_contract',
        },
      },
      mission: undefined,
    });
    expect(parseGoalSurface({ ok: true, surface: canonical })).toMatchObject({
      goal: {
        id: 'goal:v2',
        status: 'paused',
        revision: 4,
        compatibility: 'universal_v2',
        policySummary: { source: 'goal_contract' },
      },
    });
  });

  it.each([
    ['wrong schema', { ...surface(), schemaVersion: 'invented' }],
    ['wrong truth source', { ...surface(), sourceOfTruth: 'browser' }],
    ['invalid Goal state', { ...surface(), goal: { ...surface().goal, status: 'investigating' } }],
    ['invalid Mission state', { ...surface(), mission: { ...surface().mission, status: 'paused' } }],
    ['invalid Mission work state', { ...surface(), mission: { ...surface().mission, workState: 'thinking' } }],
    ['negative find count', { ...surface(), mission: { ...surface().mission, findCount: -1 } }],
    ['legacy policy mislabeled canonical', {
      ...surface(),
      goal: {
        ...surface().goal,
        policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'goal_contract' },
      },
    }],
  ])('fails closed on %s', (_name, invalidSurface) => {
    expect(() => parseGoalSurfaces({ ok: true, surfaces: [invalidSurface] })).toThrowError(GoalSurfaceContractError);
  });

  it('reports only the invalid path and does not echo the private payload', () => {
    const privateTitle = 'private goal title should not be logged';
    try {
      parseGoalSurfaces({ ok: true, surfaces: [surface({ goal: { ...surface().goal, title: privateTitle, revision: 0 } })] });
      throw new Error('Expected invalid revision.');
    } catch (error) {
      expect(error).toMatchObject({ name: 'GoalSurfaceContractError', path: 'goalSurfaces.surfaces[0].goal.revision' });
      expect(String(error)).not.toContain(privateTitle);
    }
  });

  it('loads the list through KernelClient with the existing authenticated API boundary', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('x-hephaestus-token')).toBe('t'.repeat(64));
      expect(init?.method).toBe('GET');
      return response({ ok: true, surfaces: [surface()] });
    });
    const client = new KernelClient({ baseUrl: 'http://127.0.0.1:4000', token: 't'.repeat(64), fetcher: fetcher as typeof fetch });
    await expect(loadGoalSurfaces(client)).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('encodes one Goal identity before requesting its detail surface', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('http://127.0.0.1:4000/api/goal-surfaces/goal%3A1%2Fchild');
      return response({ ok: true, surface: surface({ goal: { ...surface().goal, id: 'goal:1/child' } }) });
    });
    const client = new KernelClient({ baseUrl: 'http://127.0.0.1:4000', token: 't'.repeat(64), fetcher: fetcher as typeof fetch });
    await expect(loadGoalSurface(client, ' goal:1/child ')).resolves.toMatchObject({ goal: { id: 'goal:1/child' } });
  });

  it('rejects an invalid Goal identity before network access', async () => {
    const fetcher = vi.fn(async () => response({ ok: true, surface: surface() }));
    const client = new KernelClient({ baseUrl: 'http://127.0.0.1:4000', token: 't'.repeat(64), fetcher: fetcher as typeof fetch });
    await expect(loadGoalSurface(client, '   ')).rejects.toThrowError(GoalSurfaceContractError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves KernelClient authentication/offline failures instead of inventing empty Goal state', async () => {
    const fetcher = vi.fn(async () => response({ ok: false, code: 'AUTH_REQUIRED' }, 401));
    const client = new KernelClient({ baseUrl: 'http://127.0.0.1:4000', token: 't'.repeat(64), fetcher: fetcher as typeof fetch });
    await expect(loadGoalSurfaces(client)).rejects.toMatchObject({ name: 'KernelClientError', code: 'UNAUTHORIZED' } satisfies Partial<KernelClientError>);
  });
});
