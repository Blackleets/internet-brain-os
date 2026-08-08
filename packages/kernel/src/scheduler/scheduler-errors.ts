export class InvalidScheduleError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'InvalidScheduleError';
  }
}

export class ScheduleNotFoundError extends Error {
  constructor(readonly scheduleId: string) {
    super(`Schedule not found: ${scheduleId}`);
    this.name = 'ScheduleNotFoundError';
  }
}
