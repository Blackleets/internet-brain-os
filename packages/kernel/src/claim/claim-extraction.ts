import type { ClaimId, Confidence, Evidence, IsoDateTime } from '@internet-brain-os/shared';
import type { ClaimManager } from './claim-manager';

export interface ClaimExtractionResult {
  readonly claimIds: readonly ClaimId[];
}

export interface ClaimExtractionOptions {
  readonly idFactory: (index: number) => ClaimId;
  readonly now: IsoDateTime;
  readonly defaultConfidence?: Confidence;
}

/** Conservative first-pass extraction: creates claims only from explicit evidence statements. */
export class ClaimExtractionEngine {
  constructor(private readonly claims: ClaimManager) {}

  async extract(evidence: readonly Evidence[], options: ClaimExtractionOptions): Promise<ClaimExtractionResult> {
    const claimIds: ClaimId[] = [];
    for (const item of evidence) {
      const statement = explicitStatement(item);
      if (!statement) continue;
      const claim = await this.claims.create({
        id: options.idFactory(claimIds.length),
        statement,
        status: 'reported',
        confidence: options.defaultConfidence ?? item.confidence,
        verificationStatus: 'hypothesis',
        evidenceIds: [item.id],
        createdAt: options.now,
      });
      claimIds.push(claim.id);
    }
    return { claimIds };
  }
}

function explicitStatement(evidence: Evidence): string | null {
  const summary = evidence.summary?.trim();
  if (summary) return summary;
  const rawText = evidence.rawText?.replace(/\s+/g, ' ').trim();
  if (!rawText) return null;
  return rawText.length > 500 ? `${rawText.slice(0, 497)}...` : rawText;
}
