export class InvalidKnowledgeAdmissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidKnowledgeAdmissionInputError';
  }
}
