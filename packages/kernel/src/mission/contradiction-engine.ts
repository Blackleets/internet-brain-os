import { InvalidContradictionInputError } from './contradiction-errors';
import type {
  ContradictionAssessmentResult,
  ContradictionEvaluationInput,
  ContradictionPolicy,
  ContradictionReason,
  ExistingClaimSnapshot,
} from './contradiction-types';

const DEFAULT_POLICY: ContradictionPolicy = {
  possibleThreshold: 0.4,
  materialThreshold: 0.75,
  blockVerifiedMaterialConflicts: true,
};

export class ContradictionEngine {
  private readonly policy: ContradictionPolicy;

  public constructor(policy: Partial<ContradictionPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.validatePolicy();
  }

  public evaluate(input: ContradictionEvaluationInput): ContradictionAssessmentResult {
    this.validateInput(input);

    const existingById = new Map(input.existingClaims.map((claim) => [claim.id, claim]));
    const reasons: ContradictionReason[] = [];
    const contradictionIds: string[] = [];
    let action: ContradictionAssessmentResult['action'] = 'admit';

    for (const comparison of input.comparisons) {
      const existing = existingById.get(comparison.existingClaimId);
      if (!existing) {
        throw new InvalidContradictionInputError(
          `Comparison references unknown claim: ${comparison.existingClaimId}`,
        );
      }

      if (comparison.kind === 'none' || comparison.confidence < this.policy.possibleThreshold) {
        continue;
      }

      contradictionIds.push(existing.id);

      if (
        comparison.kind === 'material' &&
        comparison.confidence >= this.policy.materialThreshold
      ) {
        const verifiedConflict = existing.verificationStatus === 'verified';
        reasons.push({
          code: verifiedConflict ? 'verified_material_conflict' : 'material_conflict',
          message: comparison.rationale?.trim() || 'Material contradiction detected.',
          claimId: existing.id,
        });
        action =
          verifiedConflict && this.policy.blockVerifiedMaterialConflicts ? 'block' : 'review';
        continue;
      }

      reasons.push({
        code: 'possible_conflict',
        message: comparison.rationale?.trim() || 'Possible contradiction detected.',
        claimId: existing.id,
      });
      if (action === 'admit') action = 'review';
    }

    if (reasons.length === 0) {
      reasons.push({ code: 'no_conflict', message: 'No material contradiction detected.' });
    }

    return {
      candidate: {
        ...input.candidate,
        evidenceIds: [...input.candidate.evidenceIds],
        contradictsClaimIds: [...input.candidate.contradictsClaimIds],
      },
      action,
      reasons,
      contradictsClaimIds: [...new Set(contradictionIds)].sort(),
      evaluatedAt: input.evaluatedAt,
    };
  }

  private validatePolicy(): void {
    const { possibleThreshold, materialThreshold } = this.policy;
    if (
      !Number.isFinite(possibleThreshold) ||
      !Number.isFinite(materialThreshold) ||
      possibleThreshold < 0 ||
      materialThreshold > 1 ||
      possibleThreshold > materialThreshold
    ) {
      throw new InvalidContradictionInputError('Invalid contradiction policy thresholds.');
    }
  }

  private validateInput(input: ContradictionEvaluationInput): void {
    const claimIds = new Set<string>();
    for (const claim of input.existingClaims) {
      this.validateClaim(claim);
      if (claimIds.has(claim.id)) {
        throw new InvalidContradictionInputError(`Duplicate existing claim: ${claim.id}`);
      }
      claimIds.add(claim.id);
    }

    const comparisonIds = new Set<string>();
    for (const comparison of input.comparisons) {
      if (comparisonIds.has(comparison.existingClaimId)) {
        throw new InvalidContradictionInputError(
          `Duplicate contradiction comparison: ${comparison.existingClaimId}`,
        );
      }
      comparisonIds.add(comparison.existingClaimId);
      if (!Number.isFinite(comparison.confidence) || comparison.confidence < 0 || comparison.confidence > 1) {
        throw new InvalidContradictionInputError('Contradiction confidence must be between 0 and 1.');
      }
    }
  }

  private validateClaim(claim: ExistingClaimSnapshot): void {
    if (!claim.id.trim() || !claim.statement.trim()) {
      throw new InvalidContradictionInputError('Existing claims require id and statement.');
    }
    if (!Number.isFinite(claim.confidence) || claim.confidence < 0 || claim.confidence > 1) {
      throw new InvalidContradictionInputError('Existing claim confidence must be between 0 and 1.');
    }
  }
}
