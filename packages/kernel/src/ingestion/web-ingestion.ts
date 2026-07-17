import type { CaseId, Confidence, Evidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { CreateEvidenceInput, EvidenceManager } from '../evidence';

export interface IngestedWebPage {
  readonly url: string;
  readonly title: string;
  readonly text: string;
  readonly fetchedAt: IsoDateTime;
  readonly contentType: string;
}

export interface IngestWebPageInput {
  readonly page: IngestedWebPage;
  readonly evidenceId: EvidenceId;
  readonly caseId?: CaseId;
  readonly confidence?: Confidence;
}

/** Bridges a public-page connector into the evidence-first Kernel. */
export class WebIngestionService {
  constructor(private readonly evidenceManager: EvidenceManager) {}

  ingest(input: IngestWebPageInput): Promise<Evidence> {
    const evidence: CreateEvidenceInput = {
      id: input.evidenceId,
      caseId: input.caseId,
      sourceUrl: input.page.url,
      contentType: 'webpage',
      mimeType: input.page.contentType,
      rawText: input.page.text,
      summary: input.page.title,
      capturedAt: input.page.fetchedAt,
      extractionMethod: 'public-web-page-fetch',
      confidence: input.confidence ?? (0.5 as Confidence),
    };

    return this.evidenceManager.create(evidence);
  }
}
