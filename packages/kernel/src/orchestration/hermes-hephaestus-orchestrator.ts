import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchStage, ResearchStageResult } from './research-execution';
import type { ResearchExecutionResult, ResearchExecutionRuntime } from './research-execution';

export interface HermesToolContext {
  readonly caseId: CaseId;
  readonly stage: ResearchStage['state'];
  readonly attempt: number;
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

/** Bridges Hermes tool execution into the Hephaestus research runtime. */
export class HermesHephaestusOrchestrator {
  constructor(private readonly runtime: ResearchExecutionRuntime) {}

  async execute<T>(adapters: readonly HermesStageAdapter<T>[]): Promise<ResearchExecutionResult> {
    const stages: ResearchStage<T>[] = adapters.map((adapter) => ({
      state: adapter.stage,
      run: async (context) => {
        const tool = adapter.tools[0];
        if (!tool) throw new Error(`No Hermes tool available for stage: ${adapter.stage}`);

        const value = await tool.execute({
          caseId: context.caseId,
          stage: context.state,
          attempt: context.attempt,
        });

        const result: ResearchStageResult<T> = {
          value,
          completedAt: adapter.now(),
        };
        return result;
      },
    }));

    return this.runtime.run(stages);
  }
}
