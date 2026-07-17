import type { Case, CaseId, Confidence, Evidence, EvidenceId, IsoDateTime, Report, ReportId } from '@internet-brain-os/shared';
import type { EvidenceManager } from '../evidence';
import type { ReportGenerator } from '../report/report-generator';
import type { MemoryManager } from '../memory';
import type { WebIngestionService, IngestedWebPage } from '../ingestion/web-ingestion';

export interface ResearchPipelineInput {
  readonly caseRecord: Case;
  readonly sources: readonly IngestedWebPage[];
  readonly now: IsoDateTime;
  readonly evidenceIdFactory: (index: number) => EvidenceId;
  readonly reportId: ReportId;
}

export interface ResearchPipelineResult {
  readonly caseRecord: Case;
  readonly evidence: readonly Evidence[];
  readonly report: Report;
}

/** Coordinates the first complete evidence-first research loop. */
export class ResearchPipeline {
  constructor(
    private readonly ingestion: WebIngestionService,
    private readonly evidenceManager: EvidenceManager,
    private readonly memoryManager: MemoryManager,
    private readonly reportGenerator: ReportGenerator,
  ) {}

  async run(input: ResearchPipelineInput): Promise<ResearchPipelineResult> {
    const evidence: Evidence[] = [];

    for (let index = 0; index < input.sources.length; index += 1) {
      const created = await this.ingestion.ingest({
        page: input.sources[index],
        evidenceId: input.evidenceIdFactory(index),
        caseId: input.caseRecord.id as CaseId,
        confidence: 0.5 as Confidence,
      });
      evidence.push(created);
    }

    for (const item of evidence) {
      await this.memoryManager.create({
        id: `memory:${item.id}` as never,
        kind: 'observation',
        subject: item.sourceUrl ?? item.id,
        content: item.summary ?? item.rawText?.slice(0, 500) ?? 'Evidence captured without summary.',
        confidence: item.confidence,
        evidenceIds: [item.id],
        createdAt: input.now,
      });
    }

    const report = this.reportGenerator.generate({
      id: input.reportId,
      caseRecord: input.caseRecord,
      evidence,
      generatedAt: input.now,
    });

    return { caseRecord: input.caseRecord, evidence, report };
  }
}
