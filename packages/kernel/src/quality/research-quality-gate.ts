import type { Evidence, Report } from '@internet-brain-os/shared';
import { fingerprintEvidence } from '../deduplication';
import { validateResearchOutput, type ValidationResult } from '../validation';

export interface ResearchQualityGateResult extends ValidationResult {
  readonly duplicateFingerprints: readonly string[];
  readonly evidenceCount: number;
}

/** Final quality gate before research output is considered publishable. */
export function runResearchQualityGate(evidence: readonly Evidence[], report: Report): ResearchQualityGateResult {
  const fingerprints = evidence.map((item) => fingerprintEvidence(item).fingerprint);
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const fingerprint of fingerprints) {
    if (seen.has(fingerprint)) duplicates.add(fingerprint);
    seen.add(fingerprint);
  }

  const validation = validateResearchOutput(evidence, report);
  return {
    ...validation,
    duplicateFingerprints: [...duplicates],
    evidenceCount: evidence.length,
  };
}
