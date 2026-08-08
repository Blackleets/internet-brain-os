import { describe, expect, test } from 'vitest';
import { SchedulerEngine, type SchedulerStore } from './scheduler-engine';
import type { ScheduleDefinition, ScheduledRunClaim } from './scheduler-contract';
import { InvalidScheduleError } from './scheduler-errors';

function store(): SchedulerStore {
  let state: { schedules: ScheduleDefinition[]; claims: ScheduledRunClaim[] } = { schedules: [], claims: [] };
  return { transaction: async (callback) => callback(state), write: async (next) => { state = { schedules: [...next.schedules], claims: [...next.claims] }; } };
}

describe('SchedulerEngine', () => {
  test('claims a one-shot schedule exactly once', async () => {
    const scheduler = new SchedulerEngine(store(), { now: () => new Date('2026-08-08T16:00:00.000Z') });
    await scheduler.register({ id: 'schedule:1', planId: 'plan:1', revisionId: 'plan:1:rev:1', kind: 'once', startsAt: '2026-08-08T15:00:00.000Z', enabled: true });
    expect(await scheduler.claimDue()).toHaveLength(1);
    expect(await scheduler.claimDue()).toHaveLength(0);
  });

  test('interval schedule claims the latest due slot and deduplicates it', async () => {
    const scheduler = new SchedulerEngine(store(), { now: () => new Date('2026-08-08T16:05:00.000Z') });
    await scheduler.register({ id: 'schedule:interval', planId: 'plan:1', revisionId: 'rev:1', kind: 'interval', startsAt: '2026-08-08T16:00:00.000Z', intervalMs: 120000, enabled: true });
    const first = await scheduler.claimDue();
    expect(first[0]?.dueAt).toBe('2026-08-08T16:04:00.000Z');
    expect(await scheduler.claimDue()).toEqual([]);
  });

  test('daily and weekly schedules compute deterministic UTC due slots', async () => {
    const state = store();
    const scheduler = new SchedulerEngine(state, { now: () => new Date('2026-08-08T16:30:00.000Z') });
    await scheduler.register({ id: 'daily', planId: 'p', revisionId: 'r', kind: 'daily', startsAt: '2026-08-01T00:00:00.000Z', timeOfDayUtc: '15:00', enabled: true });
    await scheduler.register({ id: 'weekly', planId: 'p', revisionId: 'r', kind: 'weekly', startsAt: '2026-08-01T00:00:00.000Z', timeOfDayUtc: '12:00', dayOfWeekUtc: 6, enabled: true });
    const claims = await scheduler.claimDue();
    expect(claims.map((claim) => claim.dueAt).sort()).toEqual(['2026-08-08T12:00:00.000Z', '2026-08-08T15:00:00.000Z']);
  });

  test('rejects intervals shorter than one minute', async () => {
    const scheduler = new SchedulerEngine(store());
    await expect(scheduler.register({ id: 'bad', planId: 'p', revisionId: 'r', kind: 'interval', startsAt: '2026-08-08T00:00:00.000Z', intervalMs: 1000, enabled: true })).rejects.toThrow(InvalidScheduleError);
  });
});
