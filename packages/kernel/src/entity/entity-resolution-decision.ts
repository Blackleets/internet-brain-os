import type { Entity, EntityId, IsoDateTime } from '@internet-brain-os/shared';

export type EntityResolutionAction = 'link' | 'review' | 'create';

export interface EntityResolutionDecisionInput {
  readonly candidate: Entity;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly decidedAt: IsoDateTime;
  readonly thresholds?: {
    readonly match?: number;
    readonly candidate?: number;
  };
}

export interface EntityResolutionDecision {
  readonly entityId: EntityId;
  readonly action: EntityResolutionAction;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly decidedAt: IsoDateTime;
}

/** Converts a scored candidate into an explicit, auditable decision. */
export function decideEntityResolution(input: EntityResolutionDecisionInput): EntityResolutionDecision {
  const matchThreshold = input.thresholds?.match ?? 0.92;
  const candidateThreshold = input.thresholds?.candidate ?? 0.65;
  const score = clamp(input.score);

  const action: EntityResolutionAction = score >= matchThreshold
    ? 'link'
    : score >= candidateThreshold
      ? 'review'
      : 'create';

  return {
    entityId: input.candidate.id,
    action,
    score,
    reasons: [...new Set(input.reasons.filter(Boolean))],
    decidedAt: input.decidedAt,
  };
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
