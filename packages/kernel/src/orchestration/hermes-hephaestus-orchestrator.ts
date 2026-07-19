import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchStage, ResearchStageResult } from './research-execution';
import type { ResearchExecutionResult, ResearchExecutionRuntime } from './research-execution';
import { NonRetryableResearchError, RetryableResearchError } from './research-retry-policy';

export interface HermesToolContext {
  readonly caseId: CaseId;
  readonly stage: ResearchStage['state'];
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly abortSignal?: AbortSignal;
}

export interface HermesTool<T = unknown> {
  readonly name: string;
  readonly stages: readonly ResearchStage['state'][];
  execute(context: HermesToolContext): Promise<T>;
}

export interface HermesStageAdapter<T = unknown> {
  readonly stage: ResearchStage['state'];
  readonly tools: readonly HermesTool<T>[];
  readonly now: () => IsoDateTime;
}

/** Bridges deterministic Hermes tool fallback into the Hephaestus research runtime. */
export class HermesHephaestusOrchestrator {
  constructor(private readonly runtime: ResearchExecutionRuntime) {}

  async execute<T>(adapters: readonly HermesStageAdapter<T>[]): Promise<ResearchExecutionResult> {
    const stages: ResearchStage<T>[] = adapters.map((adapter) => ({
      state: adapter.stage,
      run: async (context) => {
        const tools = adapter.tools.filter((tool) => tool.stages.includes(adapter.stage));
        if (tools.length === 0) {
          throw new NonRetryableResearchError(`No Hermes tool supports stage: ${adapter.stage}`, 'NO_SUPPORTED_TOOL');
        }

        let lastRetryableError: RetryableResearchError | undefined;

        for (let fallbackIndex = 0; fallbackIndex < tools.length; fallbackIndex += 1) {
          const tool = tools[fallbackIndex];
          if (!tool) continue;

          try {
            const value = await tool.execute({
              caseId: context.caseId,
              stage: adapter.stage,
              attempt: context.attempt,
              idempotencyKey: context.idempotencyKey,
              abortSignal: context.abortSignal,
            });

            const result: ResearchStageResult<T> = {
              value,
              completedAt: adapter.now(),
              metadata: {
                toolName: tool.name,
                fallbackIndex,
              },
            };
            return result;
          } catch (error) {
            if (error instanceof RetryableResearchError) {
              lastRetryableError = error;
              continue;
            }
            throw error;
          }
        }

        throw lastRetryableError ?? new RetryableResearchError(
          `All Hermes tools failed for stage: ${adapter.stage}`,
          'ALL_TOOLS_FAILED',
        );
      },
    }));

    return this.runtime.run(stages);
  }
}
