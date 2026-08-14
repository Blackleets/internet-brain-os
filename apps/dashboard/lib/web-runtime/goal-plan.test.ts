import { describe, expect, it } from 'vitest';
import { buildWebGoalPlan, WebPlanInputError } from './goal-plan';

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
    expect(plan.sources.map((source) => source.id)).toEqual(['hermes', 'github']);
    expect(plan.sources.every((source) => source.status === 'not_configured')).toBe(true);
    expect(plan.limitations).toContain('preview_only');
  });

  it('rejects empty or oversized goal input before doing any work', () => {
    expect(() => buildWebGoalPlan({ title: '  ' })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'x'.repeat(121) })).toThrow(WebPlanInputError);
    expect(() => buildWebGoalPlan({ title: 'Valid goal', keywords: new Array(13).fill('keyword') })).toThrow(WebPlanInputError);
  });
});
