import type { Relationship, RelationshipId } from '@internet-brain-os/shared';

export interface RelationshipRepository {
  create(relationship: Relationship): Promise<void>;
  getById(id: RelationshipId): Promise<Relationship | null>;
  list(): Promise<readonly Relationship[]>;
  update(relationship: Relationship): Promise<void>;
}
