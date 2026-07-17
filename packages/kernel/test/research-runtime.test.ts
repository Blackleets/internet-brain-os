import { describe, expect, test } from 'vitest';
import {
  InMemoryResearchStateHistory,
  ResearchExecutionRuntime,
  ResearchStateMachine,
  ResearchStageExecutionError,
  runResearchStage,
} from '../src';
import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchStage, ResearchStageResult } from '../src';

const caseId = 'case:test' as CaseId;
const time = '2026-07-17T00:00:00.000Z' as IsoDateTime;

function stage<T>(state: ResearchStage<T>['state'], value: T): ResearchStage<T> {
  return {
    state,
    run: async (): Promise<ResearchStageResult<T>> => ({ value, completedAt: time }),
  };
}

describe('Research execution runtime', () => {
  test('executes the full lifecycle and records transitions', async () => {
    const history = new InMemoryResearchStateHistory();
    const runtime = new ResearchExecutionRuntime(
      new ResearchStateMachine({ caseId, state: 'created', updatedAt: time }),
      history,
      () => time,
    );

    const result = await runtime.run([
      stage('discovering', ['source']),
      stage('ingesting', ['document']),
      stage('analyzing', { claims: 1 }),
      stage('validating', true),
      stage('memorizing', 'memory-1'),
      stage('reporting', 'report'),
    ]);

    expect(result.state).toBe('completed');
    expect(result.failures).toHaveLength(0);
    expect(result.transitions.map((transition) => transition.to)).toEqual([
      'discovering',
      'ingesting',
      'analyzing',
      'validating',
      'memorizing',
      'reporting',
      'completed',
    ]);
    expect(history.checkpoint(caseId)?.state).toBe('completed');
  });

  test('records bounded retry failures and transitions the research to failed', async () => {
    const history = new InMemoryResearchStateHistory();
    const runtime = new ResearchExecutionRuntime(
      new ResearchStateMachine({ caseId, state: 'created', updatedAt: time }),
      history,
      () => time,
      { retry: { maxAttempts: 2 } },
    );

    const result = await runtime.run([
      {
        state: 'discovering',
        run: async () => {
          throw new Error('provider unavailable');
        },
      },
    ]);

    expect(result.state).toBe('failed');
    expect(result.failures[0]?.failures).toHaveLength(2);
    expect(result.transitions.at(-1)?.reason).toContain('exhausted retries');
  });
});

describe('Research stage retry policy', () => {
  test('retries a transient failure and exposes the successful attempt', async () => {
    let attempts = 0;

    const execution = await runResearchStage(
      {
        state: 'discovering',
        run: async (context) => {
          attempts = context.attempt;
          if (attempts < 2) throw new Error('temporary failure');
          return { value: 'ok', completedAt: time };
        },
      },
      { caseId, state: 'discovering', attempt: 1 },
      () => time,
      { maxAttempts: 3 },
    );

    expect(execution.attempts).toBe(2);
    expect(execution.failures).toHaveLength(1);
    expect(execution.result.value).toBe('ok');
  });

  test('throws a typed execution error after retries are exhausted', async () => {
    await expect(
      runResearchStage(
        {
          state: 'discovering',
          run: async () => {
            throw new Error('permanent failure');
          },
        },
        { caseId, state: 'discovering', attempt: 1 },
        () => time,
        { maxAttempts: 2 },
      ),
    ).rejects.toBeInstanceOf(ResearchStageExecutionError);
  });
});
