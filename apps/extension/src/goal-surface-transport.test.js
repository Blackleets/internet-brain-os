import { describe, expect, it, vi } from 'vitest';
import { GoalSurfaceContractError } from './goal-surface-contract.js';
import { getGoalSurface, listGoalSurfaces } from './goal-surface-transport.js';

const apiToken = 'test-token-that-is-at-least-32-characters';
const surface = {
  schemaVersion: 'efesto.goal-surface.v1',
  sourceOfTruth: 'kernel',
  observedAt: '2026-08-09T18:30:00.000Z',
  goal: {
    id: 'goal:1', title: 'Find a drill', status: 'active', revision: 1,
    createdAt: '2026-08-09T18:00:00.000Z', updatedAt: '2026-08-09T18:10:00.000Z',
    compatibility: 'legacy_radar',
    policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
  },
  mission: {
    id: 'mission:1', status: 'running', executionPhase: 'investigating', workState: 'investigating',
    createdAt: '2026-08-09T18:11:00.000Z', updatedAt: '2026-08-09T18:29:00.000Z', attempt: 1,
  },
};

describe('extension Shared Goal Truth transport', () => {
  it('loads the authenticated list through the local loopback Kernel only', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, surfaces: [surface] }) }));
    await expect(listGoalSurfaces({ fetchImpl, apiToken })).resolves.toEqual([surface]);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/goal-surfaces', expect.objectContaining({
      method: 'GET', headers: { 'x-hephaestus-token': apiToken }, signal: expect.any(AbortSignal),
    }));
  });

  it('loads one encoded Goal surface without creating a write path', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, surface }) }));
    await expect(getGoalSurface(' goal:1 ', { fetchImpl, apiToken })).resolves.toEqual(surface);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:4000/api/goal-surfaces/goal%3A1', expect.objectContaining({ method: 'GET' }));
  });

  it('rejects missing credentials, invalid Goal ids and non-loopback endpoints before network access', async () => {
    const fetchImpl = vi.fn();
    await expect(listGoalSurfaces({ fetchImpl })).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    await expect(listGoalSurfaces({ fetchImpl, apiToken, baseUrl: 'https://example.com' })).rejects.toMatchObject({ code: 'INVALID_ENDPOINT' });
    await expect(getGoalSurface('', { fetchImpl, apiToken })).rejects.toMatchObject({ code: 'INVALID_GOAL_ID' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when a successful response violates the Shared Goal Truth contract', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, surfaces: [{ ...surface, sourceOfTruth: 'extension' }] }) }));
    await expect(listGoalSurfaces({ fetchImpl, apiToken })).rejects.toBeInstanceOf(GoalSurfaceContractError);
  });

  it('surfaces HTTP rejection and transport failure without fabricating an empty Goal list', async () => {
    const rejected = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ ok: false, code: 'UNAUTHORIZED', error: 'Unauthorized' }) }));
    await expect(listGoalSurfaces({ fetchImpl: rejected, apiToken })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const offline = vi.fn(async () => { throw new TypeError('network'); });
    await expect(listGoalSurfaces({ fetchImpl: offline, apiToken })).rejects.toMatchObject({ code: 'TRANSPORT' });
  });
});
