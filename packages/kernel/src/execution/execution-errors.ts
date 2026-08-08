export class InvalidExecutionInputError extends Error {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = 'InvalidExecutionInputError';
  }
}

export class ExecutionCapabilityDeniedError extends Error {
  constructor(readonly capabilityId: string, readonly reason: string) {
    super(`Execution capability denied: ${capabilityId} (${reason})`);
    this.name = 'ExecutionCapabilityDeniedError';
  }
}

export class ExecutionApprovalRequiredError extends Error {
  constructor(readonly planId: string, readonly capabilityId: string) {
    super(`Execution requires approval for ${capabilityId} in plan ${planId}`);
    this.name = 'ExecutionApprovalRequiredError';
  }
}

export class ExecutionIdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Idempotency key was reused with different execution input`);
    this.name = 'ExecutionIdempotencyConflictError';
  }
}

export class ExecutionInDoubtError extends Error {
  constructor(readonly executionId: string) {
    super(`Execution outcome is in doubt and requires reconciliation: ${executionId}`);
    this.name = 'ExecutionInDoubtError';
  }
}

export class ExecutionAdapterNotFoundError extends Error {
  constructor(readonly capabilityId: string) {
    super(`No execution adapter registered for capability: ${capabilityId}`);
    this.name = 'ExecutionAdapterNotFoundError';
  }
}
