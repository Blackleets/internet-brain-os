// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalsView } from './efesto-product-views';
import type { OverviewSnapshot } from '../lib/kernel/overview';

function snapshotWithMissions(missions: OverviewSnapshot['missions']): OverviewSnapshot {
  return {
    readiness: { kernel: 'online' },
    metrics: { cases: 0, goals: 1, missions: missions.length, activeMissions: 0, opportunities: 0 },
    cases: [],
    goals: [{ id: 'goal-1', title: 'Find a drill offer', priority: 2, status: 'active', createdAt: '2026-07-26T10:00:00.000Z' }],
    missions,
    opportunities: [],
    activity: [],
    loadedAt: '2026-07-26T10:05:00.000Z',
    issues: [],
  };
}

describe('GoalsView mission StatePill honesty', () => {
  it('does not present completed-without-forged as Completado/completed', () => {
    render(
      <GoalsView
        snapshot={snapshotWithMissions([
          {
            id: 'mission-bare',
            goalId: 'goal-1',
            status: 'completed',
            attempt: 1,
            createdAt: '2026-07-26T10:03:00.000Z',
          },
        ])}
        onNew={() => undefined}
      />,
    );
    const pill = document.querySelector('.state-pill');
    expect(pill?.textContent).toMatch(/completed without forge/i);
    expect(pill?.textContent).not.toMatch(/^\s*completed\s*$/i);
    expect(pill?.className).not.toMatch(/\bgood\b/);
    expect(screen.getByText('Find a drill offer')).toBeTruthy();
  });

  it('presents Kernel forged missions as forged', () => {
    render(
      <GoalsView
        snapshot={snapshotWithMissions([
          {
            id: 'mission-forged',
            goalId: 'goal-1',
            status: 'completed',
            executionPhase: 'forged',
            attempt: 1,
            createdAt: '2026-07-26T10:04:00.000Z',
          },
        ])}
        onNew={() => undefined}
      />,
    );
    const pill = document.querySelector('.state-pill');
    expect(pill?.textContent).toMatch(/forged/i);
    expect(pill?.className).toMatch(/\bgood\b/);
  });
});