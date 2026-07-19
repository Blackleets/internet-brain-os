import {
  ClaimValidationGate,
  ContradictionEngine,
  KnowledgeAdmissionGate,
} from '../mission';
import type {
  ClaimProposal,
  ClaimValidationContext,
  ContradictionComparison,
  ExistingClaimSnapshot,
  MissionExecutionState,
  TaskResult,
} from '../mission';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
} from '../storage/cognitive-pipeline-types';

export interface CognitivePipelineRecordWriter {
  append(record: CognitivePipelineRecord): Promise<void>;
}

export interface RunCognitivePipelineInput {
  readonly recordId: CognitivePipelineRecordId;
  readonly execution: MissionExecutionState;
  readonly taskResult: TaskResult;
  readonly proposal: ClaimProposal;
  readonly validationContext: ClaimValidationContext;
  readonly existingClaims: readonly ExistingClaimSnapshot[];
  readonly comparisons: readonly ContradictionComparison[];
  readonly recordedAt: CognitivePipelineRecord['recordedAt'];
}

export class CognitivePipelineOrchestrator {
  constructor(
    private readonly writer: CognitivePipelineRecordWriter,
    private readonly validationGate = new ClaimValidationGate(),
    private readonly contradictionEngine = new ContradictionEngine(),
    private readonly admissionGate = new KnowledgeAdmissionGate(),
  ) {}

  async run(input: RunCognitivePipelineInput): Promise<CognitivePipelineRecord> {
    const validation = this.validationGate.evaluate(input.proposal, input.validationContext);
    const base = {
      id: input.recordId,
      execution: structuredClone(input.execution),
      taskResult: structuredClone(input.taskResult),
      validation,
      recordedAt: input.recordedAt,
    } as const;

    if (validation.decision !== 'accepted' || !validation.candidate) {
      const record: CognitivePipelineRecord = base;
      await this.writer.append(record);
      return structuredClone(record);
    }

    const contradiction = this.contradictionEngine.evaluate({
      candidate: validation.candidate,
      existingClaims: input.existingClaims,
      comparisons: input.comparisons,
      evaluatedAt: input.validationContext.evaluatedAt,
    });
    const admission = this.admissionGate.admit({
      candidate: validation.candidate,
      contradiction,
      admittedAt: input.recordedAt,
    });
    const record: CognitivePipelineRecord = {
      ...base,
      contradiction,
      admission,
    };

    await this.writer.append(record);
    return structuredClone(record);
  }
}
