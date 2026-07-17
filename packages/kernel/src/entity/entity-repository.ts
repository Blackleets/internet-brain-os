import type { Entity, EntityId } from '@internet-brain-os/shared';

export interface EntityRepository {
  create(entity: Entity): Promise<void>;
  getById(id: EntityId): Promise<Entity | null>;
  list(): Promise<readonly Entity[]>;
  update(entity: Entity): Promise<void>;
}
