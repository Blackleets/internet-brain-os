export class InvalidContradictionInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidContradictionInputError';
  }
}
