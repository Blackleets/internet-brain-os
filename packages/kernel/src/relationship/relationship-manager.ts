import type { Confidence, EntityId, IsoDateTime, Relationship, RelationshipId, VerificationStatus } from '@internet-brain-os/shared';
import type { RelationshipRepository } from './relationship-repository';

export interface CreateRelationshipInput {
  readonly id: RelationshipId;
  readonly type: string;
  readonly sourceEntityId: EntityId;
  readonly targetEntityId: EntityId;
  readonly description?: string;
  readonly verificationStatus?: VerificationStatus;
  readonly confidence: Confidence;
  readonly createdAt: IsoDateTime;
  readonly evidenceIds?: readonly string[];
}

export class RelationshipManager {
  constructor(private readonly repository: RelationshipRepository) {}

  async create(input: CreateRelationshipInput): Promise<Relationship> {
    if (await this.repository.getById(input.id)) throw new Error(`Relationship already exists: ${input.id}`);
    if (input.sourceEntityId === input.targetEntityId) throw new Error('A relationship cannot connect an entity to itself');
    const relationship: Relationship = {
      id: input.id,
      type: required(input.type, 'type'),
      sourceEntityId: input.sourceEntityId,
      targetEntityId: input.targetEntityId,
      description: input.description?.trim() || undefined,
      verificationStatus: input.verificationStatus ?? 'hypothesis',
      confidence: input.confidence,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      evidenceIds: [...new Set(input.evidenceIds ?? [])],
    };
    await this.repository.create(relationship);
    return clone(relationship);
  }

  getById(id: RelationshipId): Promise<Relationship | null> { return this.repository.getById(id); }
  list(): Promise<readonly Relationship[]> { return this.repository.list(); }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function clone(relationship: Relationship): Relationship {
  return { ...relationship, evidenceIds: [...relationship.evidenceIds] };
}
