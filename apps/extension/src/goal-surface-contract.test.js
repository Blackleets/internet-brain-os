import { describe, expect, it } from 'vitest';
import { GOAL_SURFACE_SCHEMA_VERSION, GoalSurfaceContractError, parseGoalSurface, parseGoalSurfaces } from './goal-surface-contract.js';

const surface = {
  schemaVersion: GOAL_SURFACE_SCHEMA_VERSION,
  sourceOfTruth: 'kernel',
  observedAt: '2026-08-09T18:20:00.000Z',
  goal: {
    id: 'goal:1',
    title: 'Find a drill between 18 and 25 euros',
    status: 'active',
    revision: 1,
    createdAt: '2026-08-09T18:00:00.000Z',
    updatedAt: '2026-08-09T18:10:00.000Z',
    compatibility: 'legacy_radar',
    policySummary: { autonomyLevel: 'assisted', approvalPolicy: 'none', source: 'legacy_compatibility' },
  },
  mission: {
    id: 'mission:1',
    status: 'running',
    executionPhase: 'verifying',
    workState: 'verifying',
    createdAt: '2026-08-09T18:11:00.000Z',
    updatedAt: '2026-08-09T18:19:00.000Z',
    attempt: 1,
    findCount: 2,
  },
};

describe('extension Shared Goal Truth contract', () => {
  it('accepts the Kernel-owned list contract without reinterpreting work state', () => {
    expect(parseGoalSurfaces({ ok: true, surfaces: [surface] })).toEqual([surface]);
  });

  it('preserves a Kernel-projected automatic block reason without exposing hidden runtime data', () => {
    const blocked = {
      ...surface,
      mission: { ...surface.mission, status: 'queued', executionPhase: 'queued', workState: 'failed', blockedReason: 'runtime_read_only_unverified' },
    };
    expect(parseGoalSurfaces({ ok: true, surfaces: [blocked] })[0].mission).toMatchObject({
      workState: 'failed',
      blockedReason: 'runtime_read_only_unverified',
    });
  });

  it('accepts detail responses and Goals without a current Mission', () => {
    const idle = { ...surface, mission: undefined };
    expect(parseGoalSurface({ ok: true, surface: idle })).toEqual({ ...idle, goal: { ...idle.goal } });
  });

  it.each([
    ['schemaVersion', { ...surface, schemaVersion: 'efesto.goal-surface.v2' }],
    ['sourceOfTruth', { ...surface, sourceOfTruth: 'extension' }],
    ['goal.status', { ...surface, goal: { ...surface.goal, status: 'invented' } }],
    ['mission.workState', { ...surface, mission: { ...surface.mission, workState: 'thinking' } }],
    ['mission.findCount', { ...surface, mission: { ...surface.mission, findCount: -1 } }],
    ['mission.blockedReason', { ...surface, mission: { ...surface.mission, blockedReason: '' } }],
  ])('fails closed for invalid %s', (_name, invalid) => {
    expect(() => parseGoalSurfaces({ ok: true, surfaces: [invalid] })).toThrow(GoalSurfaceContractError);
  });

  it('rejects compatibility/policy mismatches instead of upgrading legacy Goals in the client', () => {
    const invalid = {
      ...surface,
      goal: { ...surface.goal, compatibility: 'legacy_radar', policySummary: { ...surface.goal.policySummary, source: 'goal_contract' } },
    };
    expect(() => parseGoalSurfaces({ ok: true, surfaces: [invalid] })).toThrowError(
      expect.objectContaining({ path: 'goalSurfaces.surfaces[0].goal.policySummary.source' }),
    );
  });

  it('reports only the invalid path and does not echo private Goal content', () => {
    const privateTitle = 'private goal text that must not leak in validation errors';
    try {
      parseGoalSurfaces({ ok: true, surfaces: [{ ...surface, goal: { ...surface.goal, title: privateTitle, revision: 0 } }] });
      throw new Error('expected parser failure');
    } catch (error) {
      expect(error).toMatchObject({ name: 'GoalSurfaceContractError', code: 'INVALID_GOAL_SURFACE_CONTRACT', path: 'goalSurfaces.surfaces[0].goal.revision' });
      expect(String(error)).not.toContain(privateTitle);
    }
  });
});
