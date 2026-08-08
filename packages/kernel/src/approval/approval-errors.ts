export class InvalidApprovalInputError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'InvalidApprovalInputError';
  }
}

export class ApprovalCapabilityMismatchError extends Error {
  constructor(readonly planId: string) {
    super(`Approved capabilities do not exactly match the proposed plan: ${planId}`);
    this.name = 'ApprovalCapabilityMismatchError';
  }
}

export class ApprovalRevisionMismatchError extends Error {
  constructor(readonly planId: string) {
    super(`Approval revision does not match the current proposed plan: ${planId}`);
    this.name = 'ApprovalRevisionMismatchError';
  }
}
