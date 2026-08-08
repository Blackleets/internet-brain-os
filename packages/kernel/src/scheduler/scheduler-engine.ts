import { stableHash } from '../utils/hash';
import type { ScheduleDefinition, ScheduledRunClaim } from './scheduler-contract';
import { InvalidScheduleError, ScheduleNotFoundError } from './scheduler-errors';

export interface SchedulerStore {
  transaction<T>(callback: (state: { schedules: readonly ScheduleDefinition[]; claims: readonly ScheduledRunClaim[] }) => Promise<T>): Promise<T>;
  write(state: { schedules: readonly ScheduleDefinition[]; claims: readonly ScheduledRunClaim[] }): Promise<void>;
}

export interface SchedulerOptions { readonly now?: () => Date; }

export class SchedulerEngine {
  private readonly now: () => Date;
  constructor(private readonly store: SchedulerStore, options: SchedulerOptions = {}) { this.now = options.now ?? (() => new Date()); }

  async register(input: ScheduleDefinition): Promise<ScheduleDefinition> {
    const schedule = validateSchedule(input);
    return this.store.transaction(async (state) => {
      if (state.schedules.some((item) => item.id === schedule.id)) throw new InvalidScheduleError('id', `Schedule already exists: ${schedule.id}`);
      await this.store.write({ schedules: [...state.schedules.map(cloneSchedule), cloneSchedule(schedule)], claims: state.claims.map(cloneClaim) });
      return cloneSchedule(schedule);
    });
  }

  async claimDue(limit = 10): Promise<readonly ScheduledRunClaim[]> {
    const now = this.now();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
    return this.store.transaction(async (state) => {
      const existingKeys = new Set(state.claims.map((claim) => claim.idempotencyKey));
      const due = state.schedules
        .filter((schedule) => schedule.enabled)
        .map((schedule) => ({ schedule, dueAt: latestDueAt(schedule, now) }))
        .filter((item): item is { schedule: ScheduleDefinition; dueAt: Date } => item.dueAt !== null)
        .filter(({ schedule, dueAt }) => !existingKeys.has(runKey(schedule, dueAt)))
        .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime() || left.schedule.id.localeCompare(right.schedule.id))
        .slice(0, boundedLimit);
      if (!due.length) return [];
      const claimedAt = now.toISOString();
      const claims = due.map(({ schedule, dueAt }) => {
        const dueIso = dueAt.toISOString();
        const idempotencyKey = runKey(schedule, dueAt);
        return {
          id: `scheduled-run:${stableHash({ scheduleId: schedule.id, dueAt: dueIso })}`,
          scheduleId: schedule.id,
          planId: schedule.planId,
          revisionId: schedule.revisionId,
          dueAt: dueIso,
          claimedAt,
          idempotencyKey,
          status: 'claimed' as const,
        };
      });
      await this.store.write({ schedules: state.schedules.map(cloneSchedule), claims: [...state.claims.map(cloneClaim), ...claims.map(cloneClaim)] });
      return claims.map(cloneClaim);
    });
  }

  async markTerminal(claimId: string, status: 'completed' | 'failed'): Promise<ScheduledRunClaim> {
    const id = clean(claimId, 'claimId');
    return this.store.transaction(async (state) => {
      const claim = state.claims.find((item) => item.id === id);
      if (!claim) throw new ScheduleNotFoundError(id);
      if (claim.status !== 'claimed') return cloneClaim(claim);
      const next = { ...claim, status };
      await this.store.write({ schedules: state.schedules.map(cloneSchedule), claims: state.claims.map((item) => item.id === id ? cloneClaim(next) : cloneClaim(item)) });
      return cloneClaim(next);
    });
  }
}

function latestDueAt(schedule: ScheduleDefinition, now: Date): Date | null {
  const start = new Date(schedule.startsAt);
  if (start.getTime() > now.getTime()) return null;
  if (schedule.kind === 'once') return start;
  if (schedule.kind === 'interval') {
    const interval = schedule.intervalMs!;
    const elapsed = now.getTime() - start.getTime();
    return new Date(start.getTime() + Math.floor(elapsed / interval) * interval);
  }
  const [hour, minute] = schedule.timeOfDayUtc!.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setUTCHours(hour, minute, 0, 0);
  if (schedule.kind === 'daily') {
    if (candidate.getTime() > now.getTime()) candidate.setUTCDate(candidate.getUTCDate() - 1);
    return candidate.getTime() < start.getTime() ? null : candidate;
  }
  const target = schedule.dayOfWeekUtc!;
  let delta = (candidate.getUTCDay() - target + 7) % 7;
  if (delta === 0 && candidate.getTime() > now.getTime()) delta = 7;
  candidate.setUTCDate(candidate.getUTCDate() - delta);
  return candidate.getTime() < start.getTime() ? null : candidate;
}

function validateSchedule(input: ScheduleDefinition): ScheduleDefinition {
  const id = clean(input.id, 'id'); const planId = clean(input.planId, 'planId'); const revisionId = clean(input.revisionId, 'revisionId');
  const startsAt = new Date(input.startsAt); if (!Number.isFinite(startsAt.getTime())) throw new InvalidScheduleError('startsAt', 'startsAt must be an ISO timestamp');
  if (!['once', 'interval', 'daily', 'weekly'].includes(input.kind)) throw new InvalidScheduleError('kind', 'Unsupported schedule kind');
  if (input.kind === 'interval' && (!Number.isInteger(input.intervalMs) || input.intervalMs! < 60_000)) throw new InvalidScheduleError('intervalMs', 'intervalMs must be at least 60000');
  if ((input.kind === 'daily' || input.kind === 'weekly') && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timeOfDayUtc ?? '')) throw new InvalidScheduleError('timeOfDayUtc', 'timeOfDayUtc must be HH:MM');
  if (input.kind === 'weekly' && (!Number.isInteger(input.dayOfWeekUtc) || input.dayOfWeekUtc! < 0 || input.dayOfWeekUtc! > 6)) throw new InvalidScheduleError('dayOfWeekUtc', 'dayOfWeekUtc must be 0..6');
  return { id, planId, revisionId, kind: input.kind, startsAt: startsAt.toISOString(), ...(input.intervalMs === undefined ? {} : { intervalMs: input.intervalMs }), ...(input.timeOfDayUtc === undefined ? {} : { timeOfDayUtc: input.timeOfDayUtc }), ...(input.dayOfWeekUtc === undefined ? {} : { dayOfWeekUtc: input.dayOfWeekUtc }), enabled: Boolean(input.enabled) };
}
function runKey(schedule: ScheduleDefinition, dueAt: Date): string { return `schedule:${schedule.id}:${dueAt.toISOString()}`; }
function clean(value: string, field: string): string { if (typeof value !== 'string' || !value.trim() || value.length > 240) throw new InvalidScheduleError(field, `${field} is invalid`); return value.trim(); }
function cloneSchedule(value: ScheduleDefinition): ScheduleDefinition { return { ...value }; }
function cloneClaim(value: ScheduledRunClaim): ScheduledRunClaim { return { ...value }; }
