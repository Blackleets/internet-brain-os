import { describe, expect, test } from 'vitest';
import {
  HermesHephaestusOrchestrator,
  InMemoryResearchStateHistory,
  NonRetryableResearchError,
  ResearchExecutionRuntime,
  ResearchPlanValidationError,
  ResearchRuntimeReuseError,
  ResearchStageExecutionError,
  ResearchStateMachine,
  RetryableResearchError,
  runResearchStage,
} from '../src';
import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { HermesStageAdapter, ResearchStage, ResearchStageResult } from '../src';

const caseId = 'case:test' as CaseId;
const time = '2026-07-17T00:00:00.000Z' as IsoDateTime;
const states: readonly ResearchStage['state'][] = [
  'discovering',
  'ingesting',
  'analyzing',
  'validating',
  'memorizing',
  'reporting',
];

function stage<T>(state: ResearchStage<T>['state'], value: T): ResearchStage<T> {
  return {
    state,
    run: async (): Promise<ResearchStageResult<T>> => ({ value, completedAt: time }),
  };
}

function fullPlan(first?: ResearchStage): ResearchStage[] {
  return states.map((stateName, index) => index === 0 && first ? first : stage(stateName, stateName));
}

function runtime(options: ConstructorParameters<typeof ResearchExecutionRuntime>[3] = {}): ResearchExecutionRuntime {
  return new ResearchExecutionRuntime(
    new ResearchStateMachine({ caseId, state: 'created', updatedAt: time }),
    new InMemoryResearchStateHistory(),
    () => time,
    options,
  );
}

describe('Research execution runtime', () => {
  test('executes the full lifecycle and records complete telemetry', async () => {
    const result = await runtime().run(fullPlan());

    expect(result.state).toBe('completed');
    expect(result.failures).toHaveLength(0);
    expect(result.executions.size).toBe(6);
    expect(result.transitions.map((transition) => transition.to)).toEqual([
      'discovering',
      'ingesting',
      'analyzing',
      'validating',
      'memorizing',
      'reporting',
      'completed',
    ]);
  });

  test('rejects a truncated lifecycle before changing state', async () => {
    const history = new InMemoryResearchStateHistory();
    const execution = new ResearchExecutionRuntime(
      new ResearchStateMachine({ caseId, state: 'created', updatedAt: time }),
      history,
      () => time,
    );

    await expect(execution.run([stage('discovering', 'source')])).rejects.toBeInstanceOf(ResearchPlanValidationError);
    expect(history.list(caseId)).toHaveLength(0);
  });

  test('is explicitly single-use', async () => {
    const execution = runtime();
    await execution.run(fullPlan());
    await expect(execution.run(fullPlan())).rejects.toBeInstanceOf(ResearchRuntimeReuseError);
  });

  test('preserves transient failures after a later successful attempt', async () => {
    let attempts = 0;
    const result = await runtime({ retry: { maxAttempts: 2 } }).run(fullPlan({
      state: 'discovering',
      run: async () => {
        attempts += 1;
        if (attempts === 1) throw new RetryableResearchError('temporary provider failure', 'PROVIDER_UNAVAILABLE');
        return { value: 'ok', completedAt: time };
      },
    }));

    expect(result.state).toBe('completed');
    expect(result.executions.get('discovering')?.attempts).toBe(2);
    expect(result.executions.get('discovering')?.failures[0]?.code).toBe('PROVIDER_UNAVAILABLE');
  });

  test('does not retry unknown or non-retryable failures', async () => {
    let attempts = 0;
    const result = await runtime({ retry: { maxAttempts: 3 } }).run(fullPlan({
      state: 'discovering',
      run: async () => {
        attempts += 1;
        throw new NonRetryableResearchError('invalid credentials token=secret-value', 'AUTH_FAILED');
      },
    }));

    expect(attempts).toBe(1);
    expect(result.state).toBe('failed');
    expect(result.failures[0]?.failures[0]?.error).not.toContain('secret-value');
    expect(result.failures[0]?.failures[0]?.category).toBe('non_retryable');
  });

  test('propagates a stable idempotency key across retries', async () => {
    const keys: string[] = [];
    let attempts = 0;
    const result = await runtime({ retry: { maxAttempts: 2 } }).run(fullPlan({
      state: 'discovering',
      run: async (context) => {
        keys.push(context.idempotencyKey);
        attempts += 1;
        if (attempts === 1) throw new RetryableResearchError('retry');
        return { value: 'ok', completedAt: time };
      },
    }));

    expect(result.state).toBe('completed');
    expect(keys).toEqual([`${caseId}:discovering`, `${caseId}:discovering`]);
  });
});

describe('Research stage retry policy', () => {
  test('throws a typed execution error without retrying unknown errors', async () => {
    let attempts = 0;
    await expect(
      runResearchStage(
        {
          state: 'discovering',
          run: async () => {
            attempts += 1;
            throw new Error('permanent failure');
          },
        },
        { caseId, state: 'discovering', attempt: 1, idempotencyKey: `${caseId}:discovering` },
        () => time,
        { maxAttempts: 3 },
      ),
    ).rejects.toBeInstanceOf(ResearchStageExecutionError);
    expect(attempts).toBe(1);
  });

  test('honors an already-aborted parent signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runResearchStage(
        stage('discovering', 'never'),
        { caseId, state: 'discovering', attempt: 1, idempotencyKey: `${caseId}:discovering` },
        () => time,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ lastFailure: { category: 'cancelled', code: 'STAGE_CANCELLED' } });
  });
});

describe('Hermes tool orchestration', () => {
  test('uses deterministic supported-tool fallback and records the selected tool', async () => {
    const adapters: HermesStageAdapter<string>[] = states.map((stateName) => ({
      stage: stateName,
      now: () => time,
      tools: stateName === 'discovering'
        ? [
            {
              name: 'primary',
              stages: ['discovering'],
              execute: async () => { throw new RetryableResearchError('primary unavailable'); },
            },
            {
              name: 'fallback',
              stages: ['discovering'],
              execute: async () => 'fallback-result',
            },
          ]
        : [{ name: `${stateName}-tool`, stages: [stateName], execute: async () => stateName }],
    }));

    const result = await new HermesHephaestusOrchestrator(runtime()).execute(adapters);

    expect(result.state).toBe('completed');
    expect(result.results.get('discovering')?.value).toBe('fallback-result');
    expect(result.results.get('discovering')?.metadata?.toolName).toBe('fallback');
    expect(result.results.get('discovering')?.metadata?.fallbackIndex).toBe(1);
  });
});
