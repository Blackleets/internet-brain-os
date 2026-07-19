import type { ContradictionComparison, ExistingClaimSnapshot, TaskResultId } from '../mission';
import type { CognitivePipelineRecord, CognitivePipelineRecordId } from '../storage/cognitive-pipeline-types';
import {
  HermesCognitiveAdapter,
  type HermesCognitiveKernelContext,
} from './hermes-cognitive-adapter';
import {
  HermesExecutionMapper,
  type HermesExecutionEvent,
} from './hermes-execution-mapper';

export interface IngestHermesExecutionInput {
  readonly recordId: CognitivePipelineRecordId;
  readonly resultId: TaskResultId;
  readonly events: readonly HermesExecutionEvent[];
  readonly comparisons?: readonly ContradictionComparison[];
}

export interface HermesExecutionIngestionContext {
  readonly existingClaims: readonly ExistingClaimSnapshot[];
}

/**
 * Application service for completed Hermes executions.
 *
 * This service only composes normalization and cognitive submission. It does
 * not validate claims, choose contradiction outcomes, admit knowledge, or
 * persist records itself; those authorities remain inside the Kernel pipeline.
 */
export class HermesExecutionIngestionService {
  constructor(
    private readonly adapter: HermesCognitiveAdapter,
    private readonly mapper = new HermesExecutionMapper(),
  ) {}

  async ingest(
    input: IngestHermesExecutionInput,
    context: HermesExecutionIngestionContext,
  ): Promise<CognitivePipelineRecord> {
    const submission = this.mapper.map({
      recordId: input.recordId,
      resultId: input.resultId,
      events: input.events.map((event) => structuredClone(event)),
    });

    const kernelContext: HermesCognitiveKernelContext = {
      existingClaims: context.existingClaims.map((claim) => ({ ...claim })),
    };

    return this.adapter.submit(
      {
        ...submission,
        comparisons: (input.comparisons ?? []).map((comparison) => ({ ...comparison })),
      },
      kernelContext,
    );
  }
}
