import type { Confidence, Entity, EntityId, IsoDateTime, VerificationStatus } from '@internet-brain-os/shared';
import type { EntityRepository } from './entity-repository';

export interface CreateEntityInput {
  readonly id: EntityId;
  readonly type: string;
  readonly name: string;
  readonly description?: string;
  readonly aliases?: readonly string[];
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly verificationStatus?: VerificationStatus;
  readonly confidence: Confidence;
  readonly createdAt: IsoDateTime;
  readonly evidenceIds?: readonly string[];
}

export class EntityManager {
  constructor(private readonly repository: EntityRepository) {}

  async create(input: CreateEntityInput): Promise<Entity> {
    if (await this.repository.getById(input.id)) throw new Error(`Entity already exists: ${input.id}`);
    const entity: Entity = {
      id: input.id,
      type: required(input.type, 'type'),
      name: required(input.name, 'name'),
      description: input.description?.trim() || undefined,
      aliases: [...new Set((input.aliases ?? []).map((value) => value.trim()).filter(Boolean))],
      properties: { ...(input.properties ?? {}) },
      verificationStatus: input.verificationStatus ?? 'hypothesis',
      confidence: input.confidence,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      evidenceIds: [...new Set(input.evidenceIds ?? [])],
    };
    await this.repository.create(entity);
    return clone(entity);
  }

  getById(id: EntityId): Promise<Entity | null> { return this.repository.getById(id); }
  list(): Promise<readonly Entity[]> { return this.repository.list(); }

  async linkEvidence(id: EntityId, evidenceId: string, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const updated = { ...current, updatedAt, evidenceIds: [...new Set([...current.evidenceIds, evidenceId])] };
    await this.repository.update(updated);
    return clone(updated);
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function clone(entity: Entity): Entity {
  return { ...entity, aliases: entity.aliases ? [...entity.aliases] : undefined, properties: { ...entity.properties }, evidenceIds: [...entity.evidenceIds] };
}
