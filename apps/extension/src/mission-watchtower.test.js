import { describe, expect, it } from 'vitest';
import { markWatchtowerEventsRead, reconcileMissionWatchtower, unreadWatchtowerCount } from './mission-watchtower.js';

const queued = { id: 'mission:1', status: 'queued', createdAt: '2026-07-22T10:00:00Z' };
const completed = { ...queued, status: 'completed', executionPhase: 'forged', completedAt: '2026-07-22T10:05:00Z', forgedAt: '2026-07-22T10:05:00Z' };

describe('mission Watchtower', () => {
  it('seeds existing missions without notifying historical terminal work', () => {
    const result = reconcileMissionWatchtower([completed], {}, Date.parse('2026-07-22T10:06:00Z'));
    expect(result.transitions).toEqual([]);
    expect(result.state.initialized).toBe(true);
  });

  it('emits one private event when a known mission reaches a terminal state', () => {
    const baseline = reconcileMissionWatchtower([queued]).state;
    const result = reconcileMissionWatchtower([completed], baseline, Date.parse('2026-07-22T10:06:00Z'));
    expect(result.transitions).toEqual([expect.objectContaining({ missionId: 'mission:1', status: 'completed', unread: true })]);
    expect(unreadWatchtowerCount(result.state)).toBe(1);
    expect(reconcileMissionWatchtower([completed], result.state).transitions).toEqual([]);
  });

  it('does not notify newly discovered historical missions and bounds retained state', () => {
    const baseline = reconcileMissionWatchtower([queued]).state;
    const historical = Array.from({ length: 120 }, (_, index) => ({ ...completed, id: `old:${index}` }));
    const result = reconcileMissionWatchtower([queued, ...historical], baseline);
    expect(result.transitions).toEqual([]);
    expect(Object.keys(result.state.known).length).toBe(100);
  });

  it('marks result-center events read without deleting audit context', () => {
    const state = reconcileMissionWatchtower([completed], reconcileMissionWatchtower([queued]).state).state;
    const read = markWatchtowerEventsRead(state);
    expect(unreadWatchtowerCount(read)).toBe(0);
    expect(read.events).toHaveLength(1);
  });
});
