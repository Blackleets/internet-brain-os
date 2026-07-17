import type { IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchStage, ResearchStageContext, ResearchStageResult } from './research-execution';

export interface ResearchStageFailure {
  readonly state: ResearchStage['state'];
  readonly attempt: number;
  readonly error: string;
  readonly occurredAt: IsoDateTime;
}

export interface ResearchRetryPolicy {
  readonly maxAttempts?: number;
  readonly shouldRetry?: (failure: ResearchStageFailure) => boolean;
}

export interface ResearchStageExecution<T = unknown> {
  readonly result: ResearchStageResult<T>;
  readonly attempts: number;
  readonly failures: readonly ResearchStageFailure[];
}

/** Executes one research stage with bounded, observable retries. */
export async function runResearchStage<T>(
  stage: ResearchStage<T>,
  context: ResearchStageContext,
  now: () => IsoDateTime,
  policy: ResearchRetryPolicy = {},
): Promise<ResearchStageExecution<T>> {
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 3);
  const failures: ResearchStageFailure[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await stage.run({ ...context, attempt });
      return { result, attempts: attempt, failures };
    } catch (error) {
      const failure: ResearchStageFailure = {
        state: stage.state,
        attempt,
        error: error instanceof Error ? error.message : String(error),
        occurredAt: now(),
      };
      failures.push(failure);

      if (attempt >= maxAttempts || policy.shouldRetry?.(failure) === false) {
        throw new ResearchStageExecutionError(failure, failures);
      }
    }
  }

  throw new Error('Research stage execution exhausted without a result');
}

export class ResearchStageExecutionError extends Error {
  constructor(
    public readonly lastFailure: ResearchStageFailure,
    public readonly failures: readonly ResearchStageFailure[],
  ) {
    super(`Research stage ${lastFailure.state} failed after ${lastFailure.attempt} attempt(s): ${lastFailure.error}`);
    this.name = 'ResearchStageExecutionError';
  }
}
