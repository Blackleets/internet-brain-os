import type { IsoDateTime } from '@internet-brain-os/shared';
import type {
  ClaimValidationResult,
  ContradictionAssessmentResult,
  KnowledgeAdmissionResult,
  MissionExecutionState,
  TaskResult,
} from '../mission';

export type CognitivePipelineRecordId = string & {
  readonly __brand: 'CognitivePipelineRecordId';
};

export interface CognitivePipelineRecord {
  readonly id: CognitivePipelineRecordId;
  readonly execution: MissionExecutionState;
  readonly taskResult: TaskResult;
  readonly validation: ClaimValidationResult;
  readonly contradiction?: ContradictionAssessmentResult;
  readonly admission?: KnowledgeAdmissionResult;
  readonly recordedAt: IsoDateTime;
}
