export type ExecutionStatus = 'reserved' | 'completed' | 'failed' | 'in_doubt';

export interface ExecuteCapabilityInput {
  readonly planId: string;
  readonly revisionId: string;
  readonly capabilityId: string;
  readonly capabilityVersion?: string;
  readonly idempotencyKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actor: string;
}

export interface ExecutionRecord {
  readonly executionId: string;
  readonly sequence: number;
  readonly planId: string;
  readonly revisionId: string;
  readonly capabilityId: string;
  readonly capabilityVersion?: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly status: ExecutionStatus;
  readonly reservedAt: string;
  readonly completedAt?: string;
  readonly failedAt?: string;
  readonly actor: string;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly failureCode?: string;
}

export interface CapabilityExecutionAdapter {
  readonly capabilityId: string;
  execute(input: {
    readonly executionId: string;
    readonly idempotencyKey: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<Readonly<Record<string, unknown>>>;
}
