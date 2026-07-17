import type { Case, Confidence, Evidence, EvidenceId, Report, ReportId } from '@internet-brain-os/shared';

export interface GenerateReportInput {
  readonly id: ReportId;
  readonly caseRecord: Case;
  readonly evidence: readonly Evidence[];
  readonly generatedAt: Case['updatedAt'];
  readonly generatedBy?: Report['generatedBy'];
}

/** Produces a conservative evidence-backed report without inventing unsupported claims. */
export class ReportGenerator {
  generate(input: GenerateReportInput): Report {
    const evidenceIds = input.evidence.map((item) => item.id);
    const sections = [
      {
        id: 'objective',
        heading: 'Objective',
        content: input.caseRecord.objective,
        evidenceIds: [] as readonly EvidenceId[],
      },
      {
        id: 'evidence',
        heading: 'Collected Evidence',
        content: input.evidence.length
          ? input.evidence.map((item) => formatEvidence(item)).join('\n\n')
          : 'No evidence has been collected yet.',
        evidenceIds,
      },
      {
        id: 'next-actions',
        heading: 'Recommended Next Actions',
        content: input.evidence.length
          ? 'Review the collected evidence, validate high-impact claims, and identify missing sources before making a decision.'
          : 'Collect primary-source evidence before drawing conclusions.',
        evidenceIds,
      },
    ];

    return {
      id: input.id,
      caseId: input.caseRecord.id,
      title: `${input.caseRecord.title} — Evidence Report`,
      format: 'markdown',
      sections,
      limitations: [
        'This report only reflects evidence currently attached to the Case.',
        'Absence of evidence is not evidence of absence.',
      ],
      generatedAt: input.generatedAt,
      generatedBy: input.generatedBy ?? 'hybrid',
      confidence: confidenceFromEvidence(input.evidence),
    };
  }
}

function formatEvidence(item: Evidence): string {
  const source = item.sourceUrl ? ` Source: ${item.sourceUrl}.` : '';
  const summary = item.summary ?? item.rawText?.slice(0, 500) ?? 'No summary available.';
  return `- **${item.id}** (${item.contentType}, confidence ${item.confidence}). ${summary}${source}`;
}

function confidenceFromEvidence(evidence: readonly Evidence[]): Confidence {
  if (!evidence.length) return 0 as Confidence;
  const average = evidence.reduce((sum, item) => sum + Number(item.confidence), 0) / evidence.length;
  return Math.max(0, Math.min(1, average)) as Confidence;
}
