import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';

export type ResearchState =
  | 'created'
  | 'discovering'
  | 'ingesting'
  | 'analyzing'
  | 'validating'
  | 'memorizing'
  | 'reporting'
  | 'completed'
  | 'failed';

export type ResearchEvent =
  | 'start_discovery'
  | 'discovery_complete'
  | 'start_ingestion'
  | 'ingestion_complete'
  | 'start_analysis'
  | 'analysis_complete'
  | 'start_validation'
  | 'validation_complete'
  | 'start_memory'
  | 'memory_complete'
  | 'start_reporting'
  | 'report_complete'
  | 'fail'
  | 'retry';

export interface ResearchStateTransition {
  readonly caseId: CaseId;
  readonly from: ResearchState;
  readonly to: ResearchState;
  readonly event: ResearchEvent;
  readonly occurredAt: IsoDateTime;
  readonly reason?: string;
}

export interface ResearchStateSnapshot {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly updatedAt: IsoDateTime;
}

const transitions: Record<ResearchState, Partial<Record<ResearchEvent, ResearchState>>> = {
  created: { start_discovery: 'discovering' },
  discovering: { discovery_complete: 'ingesting', fail: 'failed' },
  ingesting: { ingestion_complete: 'analyzing', fail: 'failed' },
  analyzing: { analysis_complete: 'validating', fail: 'failed' },
  validating: { validation_complete: 'memorizing', fail: 'failed' },
  memorizing: { memory_complete: 'reporting', fail: 'failed' },
  reporting: { report_complete: 'completed', fail: 'failed' },
  completed: {},
  failed: { retry: 'discovering' },
};

export class ResearchStateMachine {
  constructor(private snapshot: ResearchStateSnapshot) {}

  getSnapshot(): ResearchStateSnapshot {
    return { ...this.snapshot };
  }

  transition(event: ResearchEvent, occurredAt: IsoDateTime, reason?: string): ResearchStateTransition {
    const next = transitions[this.snapshot.state][event];
    if (!next) {
      throw new Error(`Invalid research transition: ${this.snapshot.state} + ${event}`);
    }

    const transition: ResearchStateTransition = {
      caseId: this.snapshot.caseId,
      from: this.snapshot.state,
      to: next,
      event,
      occurredAt,
      reason,
    };

    this.snapshot = {
      caseId: this.snapshot.caseId,
      state: next,
      updatedAt: occurredAt,
    };

    return transition;
  }
}
