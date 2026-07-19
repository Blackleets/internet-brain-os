import type { IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchStage, ResearchStageContext, ResearchStageResult } from './research-execution';

export type ResearchFailureCategory = 'retryable' | 'non_retryable' | 'cancelled' | 'timeout' | 'unknown';

export interface ResearchStageFailure {
  readonly state: ResearchStage['state'];
  readonly attempt: number;
  readonly error: string;
  readonly code: string;
  readonly category: ResearchFailureCategory;
  readonly retryable: boolean;
  readonly occurredAt: IsoDateTime;
}

export interface ResearchRetryPolicy {
  readonly maxAttempts?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly shouldRetry?: (failure: ResearchStageFailure) => boolean;
}

export interface ResearchStageExecution<T = unknown> {
  readonly result: ResearchStageResult<T>;
  readonly attempts: number;
  readonly failures: readonly ResearchStageFailure[];
}

export class RetryableResearchError extends Error {
  constructor(message: string, public readonly code = 'RETRYABLE_ERROR') {
    super(message);
    this.name = 'RetryableResearchError';
  }
}

export class NonRetryableResearchError extends Error {
  constructor(message: string, public readonly code = 'NON_RETRYABLE_ERROR') {
    super(message);
    this.name = 'NonRetryableResearchError';
  }
}

export class ResearchStageTimeoutError extends RetryableResearchError {
  constructor(timeoutMs: number) {
    super(`Research stage timed out after ${timeoutMs}ms`, 'STAGE_TIMEOUT');
    this.name = 'ResearchStageTimeoutError';
  }
}

export class ResearchStageCancelledError extends NonRetryableResearchError {
  constructor() {
    super('Research stage execution was cancelled', 'STAGE_CANCELLED');
    this.name = 'ResearchStageCancelledError';
  }
}

/** Executes one research stage with bounded, classified, observable retries. */
export async function runResearchStage<T>(
  stage: ResearchStage<T>,
  context: ResearchStageContext,
  now: () => IsoDateTime,
  policy: ResearchRetryPolicy = {},
): Promise<ResearchStageExecution<T>> {
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 1);
  const failures: ResearchStageFailure[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const abortFromParent = (): void => controller.abort();

    if (policy.signal?.aborted) controller.abort();
    policy.signal?.addEventListener('abort', abortFromParent, { once: true });

    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (controller.signal.aborted) throw new ResearchStageCancelledError();

      const stagePromise = stage.run({
        ...context,
        attempt,
        abortSignal: controller.signal,
      });

      const result = policy.timeoutMs && policy.timeoutMs > 0
        ? await Promise.race([
            stagePromise,
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                controller.abort();
                reject(new ResearchStageTimeoutError(policy.timeoutMs as number));
              }, policy.timeoutMs);
            }),
          ])
        : await stagePromise;

      return { result, attempts: attempt, failures };
    } catch (error) {
      const classified = classifyResearchError(error);
      const failure: ResearchStageFailure = {
        state: stage.state,
        attempt,
        error: sanitizeErrorMessage(error),
        code: classified.code,
        category: classified.category,
        retryable: classified.retryable,
        occurredAt: now(),
      };
      failures.push(failure);

      const policyAllowsRetry = policy.shouldRetry?.(failure) ?? true;
      if (attempt >= maxAttempts || !classified.retryable || !policyAllowsRetry) {
        throw new ResearchStageExecutionError(failure, failures);
      }
    } finally {
      if (timer) clearTimeout(timer);
      policy.signal?.removeEventListener('abort', abortFromParent);
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

function classifyResearchError(error: unknown): {
  readonly code: string;
  readonly category: ResearchFailureCategory;
  readonly retryable: boolean;
} {
  if (error instanceof ResearchStageTimeoutError) {
    return { code: error.code, category: 'timeout', retryable: true };
  }
  if (error instanceof ResearchStageCancelledError) {
    return { code: error.code, category: 'cancelled', retryable: false };
  }
  if (error instanceof RetryableResearchError) {
    return { code: error.code, category: 'retryable', retryable: true };
  }
  if (error instanceof NonRetryableResearchError) {
    return { code: error.code, category: 'non_retryable', retryable: false };
  }
  return { code: 'UNKNOWN_ERROR', category: 'unknown', retryable: false };
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/(bearer\s+)[^\s]+/gi, '$1[REDACTED]')
    .replace(/((?:^|[?&\s])(?:token|api_key|apikey|key|secret)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_KEY]')
    .slice(0, 500);
}
