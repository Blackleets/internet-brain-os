import { describe, expect, it } from 'vitest';
import { extractGoalWorkModeConstraint, extractObservedWorkModes, evaluateGoalWorkModeConstraint } from './goal-work-mode-constraints.mjs';

describe('verified remote-work Goal constraint', () => {
  it('derives remote intent from the canonical Goal title', () => {
    expect(extractGoalWorkModeConstraint('Find recent remote freelance work at $20/hour or more')).toEqual({ mode: 'remote', source: 'goal_title' });
  });

  it('observes explicit remote, hybrid and onsite page facts', () => {
    expect(extractObservedWorkModes({ title: 'Remote AI contractor', visibleText: 'This is a fully remote role.' })).toEqual(expect.arrayContaining([
      { mode: 'remote', source: 'kernel_verified_page_text', field: 'title' },
      { mode: 'remote', source: 'kernel_verified_page_text', field: 'visibleText' },
    ]));
    expect(extractObservedWorkModes({ visibleText: 'Hybrid position with 3 days in-office.' })).toEqual(expect.arrayContaining([
      { mode: 'hybrid', source: 'kernel_verified_page_text', field: 'visibleText' },
      { mode: 'onsite', source: 'kernel_verified_page_text', field: 'visibleText' },
    ]));
  });

  it('does not accept explicitly negated remote work', () => {
    const facts = extractObservedWorkModes({ visibleText: 'This position is not remote. On-site only in Madrid.' });
    expect(facts).toEqual(expect.arrayContaining([
      { mode: 'not_remote', source: 'kernel_verified_page_text', field: 'visibleText' },
      { mode: 'onsite', source: 'kernel_verified_page_text', field: 'visibleText' },
    ]));
    expect(facts.some((item) => item.mode === 'remote')).toBe(false);
  });

  it('requires verified remote page evidence before a remote Goal can match', () => {
    const goal = { title: 'Find remote freelance work' };
    expect(evaluateGoalWorkModeConstraint(goal, { observedFacts: { workModes: [{ mode: 'remote', source: 'kernel_verified_page_text', field: 'description' }] } })).toMatchObject({ required: true, status: 'verified' });
    expect(evaluateGoalWorkModeConstraint(goal, { observedFacts: { workModes: [{ mode: 'onsite', source: 'kernel_verified_page_text', field: 'description' }] } })).toMatchObject({ required: true, status: 'violated' });
    expect(evaluateGoalWorkModeConstraint(goal, {})).toMatchObject({ required: true, status: 'unverified' });
  });
});
