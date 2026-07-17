import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchEvent, ResearchState, ResearchStateMachine, ResearchStateTransition } from './research-state-machine';
import type { ResearchStateHistory } from './research-state-machine-history';
import { runResearchStage, type ResearchRetryPolicy, type ResearchStageFailure } from './research-retry-policy';

export interface ResearchStageResult<T = unknown> {
  readonly value: T;
  readonly completedAt: IsoDateTime;
}

export interface ResearchStageContext {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly attempt: number;
}

export interface ResearchStage<T = unknown> {
  readonly state: Exclude<ResearchState, 'created' | 'completed' | 'failed'>;
  run(context: ResearchStageContext): Promise<ResearchStageResult<T>>;
}

export interface ResearchExecutionFailure {
  readonly state: ResearchState;
  readonly failures: readonly ResearchStageFailure[];
}

export interface ResearchExecutionResult {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly transitions: readonly ResearchStateTransition[];
  readonly results: ReadonlyMap<ResearchState, ResearchStageResult>;
  readonly failures: readonly ResearchExecutionFailure[];
}

export interface ResearchExecutionOptions {
  readonly retry?: ResearchRetryPolicy;
}

/** Executes research stages with bounded retries, failure telemetry, and state history. */
export class ResearchExecutionRuntime {
  constructor(
    private readonly machine: ResearchStateMachine,
    private readonly history: ResearchStateHistory,
    private readonly now: () => IsoDateTime,
    private readonly options: ResearchExecutionOptions = {},
  ) {}

  async run(stages: readonly ResearchStage[]): Promise<ResearchExecutionResult> {
    const results = new Map<ResearchState, ResearchStageResult>();
    const transitions: ResearchStateTransition[] = [];
    const failures: ResearchExecutionFailure[] = [];

    this.record(this.machine.transition('start_discovery', this.now()), transitions);

    for (const stage of stages) {
      const current = this.machine.getSnapshot().state;
      if (current !== stage.state) {
        throw new Error(`Stage order mismatch: expected ${current}, received ${stage.state}`);
      }

      const context: ResearchStageContext = {
        caseId: this.machine.getSnapshot().caseId,
        state: current,
        attempt: 1,
      };

      try {
        const execution = await runResearchStage(stage, context, this.now, this.options.retry);
        results.set(stage.state, execution.result);
        const nextEvent = completionEvent(stage.state);
        this.record(this.machine.transition(nextEvent, execution.result.completedAt), transitions);
      } catch (error) {
        const stageError = error as { failures?: readonly ResearchStageFailure[] };
        const stageFailures = stageError.failures ?? [];
        failures.push({ state: stage.state, failures: stageFailures });
        this.record(this.machine.transition('fail', this.now(), `Stage ${stage.state} exhausted retries`), transitions);
        break;
      }
    }

    return {
      caseId: this.machine.getSnapshot().caseId,
      state: this.machine.getSnapshot().state,
      transitions,
      results,
      failures,
    };
  }

  private record(transition: ResearchStateTransition, output: ResearchStateTransition[]): void {
    this.history.append(transition);
    output.push(transition);
  }
}

function completionEvent(state: Exclude<ResearchState, 'created' | 'completed' | 'failed'>): ResearchEvent {
  const events: Record<Exclude<ResearchState, 'created' | 'completed' | 'failed'>, ResearchEvent> = {
    discovering: 'discovery_complete',
    ingesting: 'ingestion_complete',
    analyzing: 'analysis_complete',
    validating: 'validation_complete',
    memorizing: 'memory_complete',
    reporting: 'report_complete',
  };
  return events[state];
}
