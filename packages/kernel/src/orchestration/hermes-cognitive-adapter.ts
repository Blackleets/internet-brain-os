import type {
  ClaimEvidenceAssessment,
  ClaimProposalId,
  ContradictionComparison,
  ExistingClaimSnapshot,
  MissionExecutionState,
  TaskResult,
} from '../mission';
import type {
  CognitivePipelineRecord,
  CognitivePipelineRecordId,
} from '../storage/cognitive-pipeline-types';
import type {
  RunCognitivePipelineInput,
} from './cognitive-pipeline-orchestrator';

export interface HermesCognitiveSubmission {
  readonly recordId: CognitivePipelineRecordId;
  readonly execution: MissionExecutionState;
  readonly taskResult: TaskResult;
  readonly proposalId: ClaimProposalId;
  readonly evidence: readonly ClaimEvidenceAssessment[];
  readonly comparisons: readonly ContradictionComparison[];
  readonly submittedAt: CognitivePipelineRecord['recordedAt'];
}

export interface HermesCognitiveKernelContext {
  readonly existingClaims: readonly ExistingClaimSnapshot[];
}

export interface CognitivePipelineRunner {
  run(input: RunCognitivePipelineInput): Promise<CognitivePipelineRecord>;
}

export class InvalidHermesCognitiveSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidHermesCognitiveSubmissionError';
  }
}

const FORBIDDEN_AUTHORITY_FIELDS = [
  'candidate',
  'validation',
  'contradiction',
  'admission',
  'claim',
  'durableClaim',
] as const;

/**
 * Converts untrusted Hermes research output into the narrow deterministic input
 * accepted by the Kernel cognitive pipeline. Hermes may propose and assess;
 * it cannot manufacture validation, admission, or durable knowledge records.
 */
export class HermesCognitiveAdapter {
  constructor(private readonly pipeline: CognitivePipelineRunner) {}

  async submit(
    submission: HermesCognitiveSubmission,
    context: HermesCognitiveKernelContext,
  ): Promise<CognitivePipelineRecord> {
    this.validateSubmission(submission, context);

    const proposal = submission.taskResult.claimProposals.find(
      (candidate) => candidate.id === submission.proposalId,
    );
    if (!proposal) {
      throw new InvalidHermesCognitiveSubmissionError(
        `Hermes proposal does not belong to task result: ${submission.proposalId}`,
      );
    }

    return this.pipeline.run({
      recordId: submission.recordId,
      execution: structuredClone(submission.execution),
      taskResult: structuredClone(submission.taskResult),
      proposal: structuredClone(proposal),
      validationContext: {
        evidence: submission.evidence.map((assessment) => ({ ...assessment })),
        evaluatedAt: submission.submittedAt,
      },
      existingClaims: context.existingClaims.map((claim) => ({ ...claim })),
      comparisons: submission.comparisons.map((comparison) => ({ ...comparison })),
      recordedAt: submission.submittedAt,
    });
  }

  private validateSubmission(
    submission: HermesCognitiveSubmission,
    context: HermesCognitiveKernelContext,
  ): void {
    const raw = submission as unknown as Record<string, unknown>;
    for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
      if (field in raw) {
        throw new InvalidHermesCognitiveSubmissionError(
          `Hermes cannot supply Kernel authority field: ${field}`,
        );
      }
    }

    if (!submission.recordId || !submission.proposalId || !submission.submittedAt) {
      throw new InvalidHermesCognitiveSubmissionError(
        'recordId, proposalId, and submittedAt are required.',
      );
    }

    if (submission.execution.missionId !== submission.taskResult.missionId) {
      throw new InvalidHermesCognitiveSubmissionError(
        'Hermes execution and task result mission IDs differ.',
      );
    }

    const existingClaimIds = new Set(context.existingClaims.map((claim) => claim.id));
    for (const comparison of submission.comparisons) {
      if (!existingClaimIds.has(comparison.existingClaimId)) {
        throw new InvalidHermesCognitiveSubmissionError(
          `Hermes comparison references unknown Kernel claim: ${comparison.existingClaimId}`,
        );
      }
    }
  }
}
