import type { CaseId, IsoDateTime } from '@internet-brain-os/shared';
import type { ResearchState, ResearchStateTransition } from './research-state-machine';

export interface ResearchCheckpoint {
  readonly caseId: CaseId;
  readonly state: ResearchState;
  readonly updatedAt: IsoDateTime;
  readonly transitionCount: number;
}

export interface ResearchStateHistory {
  append(transition: ResearchStateTransition): void;
  list(caseId?: CaseId): readonly ResearchStateTransition[];
  checkpoint(caseId: CaseId): ResearchCheckpoint | undefined;
}

/** Append-only history and resumable checkpoints for research execution. */
export class InMemoryResearchStateHistory implements ResearchStateHistory {
  private readonly transitions: ResearchStateTransition[] = [];

  append(transition: ResearchStateTransition): void {
    this.transitions.push({ ...transition });
  }

  list(caseId?: CaseId): readonly ResearchStateTransition[] {
    return this.transitions
      .filter((transition) => !caseId || transition.caseId === caseId)
      .map((transition) => ({ ...transition }));
  }

  checkpoint(caseId: CaseId): ResearchCheckpoint | undefined {
    const transitions = this.list(caseId);
    const last = transitions.at(-1);
    if (!last) return undefined;

    return {
      caseId,
      state: last.to,
      updatedAt: last.occurredAt,
      transitionCount: transitions.length,
    };
  }
}
