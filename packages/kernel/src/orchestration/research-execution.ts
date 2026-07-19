import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchEvent, ResearchState, ResearchStateMachine, ResearchStateTransition } from './research-state-machine';
import type { ResearchStateHistory } from './research-state-machine-history';
import { runResearchStage, type ResearchRetryPolicy, type ResearchStageExecution, type ResearchStageFailure } from './research-retry-policy';

export interface ResearchStageResult<T = unknown> {
  readonly value: T;
  readonly completedAt: IsoDateTime;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface ResearchStageContext {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly attempt: number;
  readonly idempotencyKey: string;
  readonly abortSignal?: AbortSignal;
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
  readonly executions: ReadonlyMap<ResearchState, ResearchStageExecution>;
  readonly failures: readonly ResearchExecutionFailure[];
}

export interface ResearchExecutionOptions {
  readonly retry?: ResearchRetryPolicy;
}

const canonicalPlan: readonly ResearchStage['state'][] = [
  'discovering',
  'ingesting',
  'analyzing',
  'validating',
  'memorizing',
  'reporting',
];

export class ResearchPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResearchPlanValidationError';
  }
}

export class ResearchRuntimeReuseError extends Error {
  constructor() {
    super('ResearchExecutionRuntime instances are single-use');
    this.name = 'ResearchRuntimeReuseError';
  }
}

/** Executes a complete research lifecycle with bounded retries and full telemetry. */
export class ResearchExecutionRuntime {
  private hasRun = false;

  constructor(
    private readonly machine: ResearchStateMachine,
    private readonly history: ResearchStateHistory,
    private readonly now: () => IsoDateTime,
    private readonly options: ResearchExecutionOptions = {},
  ) {}

  async run(stages: readonly ResearchStage[]): Promise<ResearchExecutionResult> {
    if (this.hasRun) throw new ResearchRuntimeReuseError();
    this.hasRun = true;
    validatePlan(stages);

    const initial = this.machine.getSnapshot();
    if (initial.state !== 'created') {
      throw new ResearchPlanValidationError(`Research must start in created state, received ${initial.state}`);
    }

    const results = new Map<ResearchState, ResearchStageResult>();
    const executions = new Map<ResearchState, ResearchStageExecution>();
    const transitions: ResearchStateTransition[] = [];
    const failures: ResearchExecutionFailure[] = [];

    this.record(this.machine.transition('start_discovery', this.now()), transitions);

    for (const stage of stages) {
      const current = this.machine.getSnapshot().state;
      if (current !== stage.state) {
        throw new ResearchPlanValidationError(`Stage order mismatch: expected ${current}, received ${stage.state}`);
      }

      const context: ResearchStageContext = {
        caseId: this.machine.getSnapshot().caseId,
        state: current,
        attempt: 1,
        idempotencyKey: `${this.machine.getSnapshot().caseId}:${current}`,
      };

      try {
        const execution = await runResearchStage(stage, context, this.now, this.options.retry);
        executions.set(stage.state, execution);
        results.set(stage.state, execution.result);
        this.record(this.machine.transition(completionEvent(stage.state), execution.result.completedAt), transitions);
      } catch (error) {
        const stageError = error as { failures?: readonly ResearchStageFailure[] };
        const stageFailures = stageError.failures ?? [];
        failures.push({ state: stage.state, failures: stageFailures });
        this.record(this.machine.transition('fail', this.now(), `Stage ${stage.state} failed safely`), transitions);
        break;
      }
    }

    return {
      caseId: this.machine.getSnapshot().caseId,
      state: this.machine.getSnapshot().state,
      transitions,
      results,
      executions,
      failures,
    };
  }

  private record(transition: ResearchStateTransition, output: ResearchStateTransition[]): void {
    this.history.append(transition);
    output.push(transition);
  }
}

function validatePlan(stages: readonly ResearchStage[]): void {
  const states = stages.map((stage) => stage.state);
  if (states.length !== canonicalPlan.length || states.some((state, index) => state !== canonicalPlan[index])) {
    throw new ResearchPlanValidationError(`Research plan must contain the complete canonical lifecycle: ${canonicalPlan.join(' -> ')}`);
  }
}

function completionEvent(state: ResearchStage['state']): ResearchEvent {
  const events: Record<ResearchStage['state'], ResearchEvent> = {
    discovering: 'discovery_complete',
    ingesting: 'ingestion_complete',
    analyzing: 'analysis_complete',
    validating: 'validation_complete',
    memorizing: 'memory_complete',
    reporting: 'report_complete',
  };
  return events[state];
}
