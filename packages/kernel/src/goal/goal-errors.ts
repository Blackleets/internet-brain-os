export class InvalidGoalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGoalError';
  }
}