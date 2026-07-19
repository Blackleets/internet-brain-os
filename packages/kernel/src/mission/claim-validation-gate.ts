import type { EvidenceId } from '@internet-brain-os/shared';
import { InvalidClaimValidationInputError } from './claim-validation-errors';
import type {
  ClaimContradictionAssessment,
  ClaimEvidenceAssessment,
  ClaimValidationContext,
  ClaimValidationPolicy,
  ClaimValidationReason,
  ClaimValidationResult,
} from './claim-validation-types';
import type { ClaimProposal } from './task-result-types';

const DEFAULT_POLICY: ClaimValidationPolicy = {
  minimumEvidenceCount: 1,
  minimumAcceptedConfidence: 0.75,
  minimumReviewConfidence: 0.5,
  materialContradictionConfidence: 0.7,
  requireVerifiedEvidence: true,
};

export class ClaimValidationGate {
  private readonly policy: ClaimValidationPolicy;

  constructor(policy: Partial<ClaimValidationPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.validatePolicy(this.policy);
  }

  evaluate(proposal: ClaimProposal, context: ClaimValidationContext): ClaimValidationResult {
    this.validateInput(proposal, context);

    const evidenceById = new Map(
      context.evidence.map((assessment) => [assessment.evidenceId, assessment] as const),
    );
    const reasons: ClaimValidationReason[] = [];

    const missing = proposal.evidenceIds.filter((id) => !evidenceById.get(id)?.exists);
    if (missing.length > 0) {
      reasons.push({
        code: 'missing_evidence',
        message: `Missing evidence: ${missing.join(', ')}`,
      });
    }

    if (proposal.evidenceIds.length < this.policy.minimumEvidenceCount) {
      reasons.push({
        code: 'insufficient_evidence',
        message: `At least ${this.policy.minimumEvidenceCount} evidence record(s) are required.`,
      });
    }

    const unverified = proposal.evidenceIds.filter((id) => {
      const assessment = evidenceById.get(id);
      return assessment?.exists === true && assessment.verified === false;
    });
    if (this.policy.requireVerifiedEvidence && unverified.length > 0) {
      reasons.push({
        code: 'unverified_evidence',
        message: `Unverified evidence: ${unverified.join(', ')}`,
      });
    }

    if (proposal.confidence < this.policy.minimumReviewConfidence) {
      reasons.push({
        code: 'low_confidence',
        message: `Confidence ${proposal.confidence} is below the review floor ${this.policy.minimumReviewConfidence}.`,
      });
    } else if (proposal.confidence < this.policy.minimumAcceptedConfidence) {
      reasons.push({
        code: 'low_confidence',
        message: `Confidence ${proposal.confidence} is below the acceptance threshold ${this.policy.minimumAcceptedConfidence}.`,
      });
    }

    const materialContradictions = this.materialContradictions(context.contradictions ?? []);
    if (materialContradictions.length > 0) {
      reasons.push({
        code: 'material_contradiction',
        message: `Material contradictions: ${materialContradictions.map((item) => item.claimId).join(', ')}`,
      });
    }

    const hardReject = reasons.some((reason) =>
      reason.code === 'missing_evidence'
      || reason.code === 'insufficient_evidence'
      || (reason.code === 'low_confidence' && proposal.confidence < this.policy.minimumReviewConfidence),
    );

    if (hardReject) {
      return this.result(proposal, context, 'rejected', reasons);
    }

    if (reasons.length > 0) {
      return this.result(proposal, context, 'needs_review', reasons);
    }

    return {
      proposal: this.cloneProposal(proposal),
      decision: 'accepted',
      reasons: [],
      candidate: {
        id: `claim-candidate:${proposal.id}`,
        proposalId: proposal.id,
        statement: proposal.statement,
        confidence: proposal.confidence,
        evidenceIds: [...proposal.evidenceIds],
        contradictsClaimIds: [],
        status: 'candidate',
        createdAt: context.evaluatedAt,
      },
      evaluatedAt: context.evaluatedAt,
    };
  }

  private result(
    proposal: ClaimProposal,
    context: ClaimValidationContext,
    decision: 'rejected' | 'needs_review',
    reasons: readonly ClaimValidationReason[],
  ): ClaimValidationResult {
    return {
      proposal: this.cloneProposal(proposal),
      decision,
      reasons: reasons.map((reason) => ({ ...reason })),
      evaluatedAt: context.evaluatedAt,
    };
  }

  private materialContradictions(
    contradictions: readonly ClaimContradictionAssessment[],
  ): readonly ClaimContradictionAssessment[] {
    return contradictions
      .filter((item) => item.confidence >= this.policy.materialContradictionConfidence)
      .map((item) => ({ ...item }));
  }

  private cloneProposal(proposal: ClaimProposal): ClaimProposal {
    return {
      ...proposal,
      evidenceIds: [...proposal.evidenceIds],
    };
  }

  private validateInput(proposal: ClaimProposal, context: ClaimValidationContext): void {
    if (proposal.status !== 'proposed') {
      throw new InvalidClaimValidationInputError('Only proposed claims may be evaluated.');
    }
    if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1) {
      throw new InvalidClaimValidationInputError('Claim confidence must be between 0 and 1.');
    }
    if (proposal.evidenceIds.length === 0) {
      throw new InvalidClaimValidationInputError('Claim proposal must cite evidence.');
    }
    this.assertUniqueEvidence(context.evidence);
    for (const contradiction of context.contradictions ?? []) {
      if (!contradiction.claimId.trim()) {
        throw new InvalidClaimValidationInputError('Contradiction claim ID is required.');
      }
      if (!Number.isFinite(contradiction.confidence) || contradiction.confidence < 0 || contradiction.confidence > 1) {
        throw new InvalidClaimValidationInputError('Contradiction confidence must be between 0 and 1.');
      }
    }
  }

  private assertUniqueEvidence(evidence: readonly ClaimEvidenceAssessment[]): void {
    const seen = new Set<EvidenceId>();
    for (const assessment of evidence) {
      if (seen.has(assessment.evidenceId)) {
        throw new InvalidClaimValidationInputError(`Duplicate evidence assessment: ${assessment.evidenceId}`);
      }
      seen.add(assessment.evidenceId);
    }
  }

  private validatePolicy(policy: ClaimValidationPolicy): void {
    const thresholds = [
      policy.minimumAcceptedConfidence,
      policy.minimumReviewConfidence,
      policy.materialContradictionConfidence,
    ];
    if (!Number.isInteger(policy.minimumEvidenceCount) || policy.minimumEvidenceCount < 1) {
      throw new InvalidClaimValidationInputError('minimumEvidenceCount must be a positive integer.');
    }
    if (thresholds.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      throw new InvalidClaimValidationInputError('Validation confidence thresholds must be between 0 and 1.');
    }
    if (policy.minimumReviewConfidence > policy.minimumAcceptedConfidence) {
      throw new InvalidClaimValidationInputError('Review confidence cannot exceed acceptance confidence.');
    }
  }
}
