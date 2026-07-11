// report.ts
import type { ReportId, CaseId, IsoDateTime, Confidence } from './common';
import type { EvidenceId } from './common';

export type ReportFormat =
  | 'markdown'
  | 'text'
  | 'json'
  | 'html';

export interface ReportSection {
  readonly id: string;
  readonly heading: string;
  readonly content: string;
  readonly evidenceIds: readonly EvidenceId[];
}

export interface Report {
  readonly id: ReportId;
  readonly caseId?: CaseId;
  readonly title: string;
  readonly format: ReportFormat;
  readonly sections: readonly ReportSection[];
  readonly limitations: readonly string[];
  readonly generatedAt: IsoDateTime;
  readonly generatedBy: 'human' | 'ai' | 'hybrid';
  readonly confidence: Confidence;
}