export class InvalidClaimValidationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidClaimValidationInputError';
  }
}
