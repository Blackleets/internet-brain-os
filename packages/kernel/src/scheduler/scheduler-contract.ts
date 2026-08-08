export type ScheduleKind = 'once' | 'interval' | 'daily' | 'weekly';

export interface ScheduleDefinition {
  readonly id: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly kind: ScheduleKind;
  readonly startsAt: string;
  readonly intervalMs?: number;
  readonly timeOfDayUtc?: string;
  readonly dayOfWeekUtc?: number;
  readonly enabled: boolean;
}

export interface ScheduledRunClaim {
  readonly id: string;
  readonly scheduleId: string;
  readonly planId: string;
  readonly revisionId: string;
  readonly dueAt: string;
  readonly claimedAt: string;
  readonly idempotencyKey: string;
  readonly status: 'claimed' | 'completed' | 'failed';
}
