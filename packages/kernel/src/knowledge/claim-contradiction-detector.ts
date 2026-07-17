import type { Claim, ClaimId } from '@internet-brain-os/shared';

export interface ClaimContradiction {
  readonly claimId: ClaimId;
  readonly contradictingClaimId: ClaimId;
}

/** Detects explicit contradiction links without inventing semantic contradictions. */
export class ClaimContradictionDetector {
  detect(claims: readonly Claim[]): readonly ClaimContradiction[] {
    const known = new Set(claims.map((claim) => claim.id));
    const results: ClaimContradiction[] = [];
    for (const claim of claims) {
      for (const contradictingClaimId of claim.contradictsClaimIds) {
        if (!known.has(contradictingClaimId)) continue;
        results.push({ claimId: claim.id, contradictingClaimId });
      }
    }
    return results;
  }
}
