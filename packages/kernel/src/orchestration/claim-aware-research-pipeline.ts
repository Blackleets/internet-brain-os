import type { Case, ClaimId, EvidenceId, IsoDateTime, ReportId } from '@internet-brain-os/shared';
import type { IngestedWebPage } from '../ingestion/web-ingestion';
import { ResearchPipeline, type ResearchPipelineResult } from './research-pipeline';
import type { ClaimExtractionEngine } from '../claim';

export interface ClaimAwareResearchPipelineInput {
  readonly caseRecord: Case;
  readonly sources: readonly IngestedWebPage[];
  readonly now: IsoDateTime;
  readonly evidenceIdFactory: (index: number) => EvidenceId;
  readonly claimIdFactory: (index: number) => ClaimId;
  readonly reportId: ReportId;
}

export interface ClaimAwareResearchPipelineResult extends ResearchPipelineResult {
  readonly claimIds: readonly ClaimId[];
}

/** Additive adapter that enriches the stable research pipeline with claims without changing its constructor contract. */
export class ClaimAwareResearchPipeline {
  constructor(
    private readonly research: ResearchPipeline,
    private readonly claims: ClaimExtractionEngine,
  ) {}

  async run(input: ClaimAwareResearchPipelineInput): Promise<ClaimAwareResearchPipelineResult> {
    const result = await this.research.run(input);
    const extracted = await this.claims.extract(result.evidence, {
      idFactory: input.claimIdFactory,
      now: input.now,
    });
    return { ...result, claimIds: extracted.claimIds };
  }
}
