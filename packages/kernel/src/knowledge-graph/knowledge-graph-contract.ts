import type { Entity, EntityId, Relationship } from '@internet-brain-os/shared';

export type TemporalSubjectType = 'entity' | 'relationship';
export type TemporalValue = string | number | boolean | null;

export interface TemporalProperty {
  readonly id: string;
  readonly subjectType: TemporalSubjectType;
  readonly subjectId: string;
  readonly key: string;
  readonly value: TemporalValue;
  readonly evidenceIds: readonly string[];
  readonly observedAt: string;
  readonly validFrom?: string;
  readonly expiresAt?: string;
  readonly supersedes?: string;
}

export interface EntityKnowledgeView {
  readonly entity: Entity;
  readonly temporalProperties: readonly TemporalProperty[];
  readonly relationships: readonly Relationship[];
}

export interface GoalRelevantEntity {
  readonly entityId: EntityId;
  readonly score: number;
  readonly matchedTerms: readonly string[];
}
