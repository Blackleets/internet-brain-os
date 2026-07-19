import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { MissionId, MissionTaskId } from './mission-types';

export type TaskResultId = string & { readonly __brand: 'TaskResultId' };
export type ClaimProposalId = string & { readonly __brand: 'ClaimProposalId' };

export interface ClaimProposalDraft {
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly EvidenceId[];
  readonly rationale?: string;
}

export interface ClaimProposal {
  readonly id: ClaimProposalId;
  readonly missionId: MissionId;
  readonly taskId: MissionTaskId;
  readonly statement: string;
  readonly confidence: number;
  readonly evidenceIds: readonly EvidenceId[];
  readonly rationale?: string;
  readonly status: 'proposed';
  readonly createdAt: IsoDateTime;
}

export interface TaskResult {
  readonly id: TaskResultId;
  readonly missionId: MissionId;
  readonly taskId: MissionTaskId;
  readonly summary: string;
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimProposals: readonly ClaimProposal[];
  readonly createdAt: IsoDateTime;
}

export interface CreateTaskResultInput {
  readonly id: TaskResultId;
  readonly summary: string;
  readonly claimProposals?: readonly ClaimProposalDraft[];
  readonly createdAt: IsoDateTime;
}
