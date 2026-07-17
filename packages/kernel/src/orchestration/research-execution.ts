import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchEvent, ResearchState, ResearchStateMachine, ResearchStateTransition } from './research-state-machine';
import type { ResearchStateHistory } from './research-state-machine-history';

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

export interface ResearchExecutionResult {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly transitions: readonly ResearchStateTransition[];
  readonly results: ReadonlyMap<ResearchState, ResearchStageResult>;
}

/** Executes research stages through the explicit state machine and records every transition. */
export class ResearchExecutionRuntime {
  constructor(
    private readonly machine: ResearchStateMachine,
    private readonly history: ResearchStateHistory,
    private readonly now: () => IsoDateTime,
  ) {}

  async run(stages: readonly ResearchStage[]): Promise<ResearchExecutionResult> {
    const results = new Map<ResearchState, ResearchStageResult>();
    const transitions: ResearchStateTransition[] = [];

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
      const result = await stage.run(context);
      results.set(stage.state, result);

      const nextEvent = completionEvent(stage.state);
      this.record(this.machine.transition(nextEvent, result.completedAt), transitions);
    }

    return {
      caseId: this.machine.getSnapshot().caseId,
      state: this.machine.getSnapshot().state,
      transitions,
      results,
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
