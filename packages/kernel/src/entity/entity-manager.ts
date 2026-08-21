import type { Confidence, Entity, EntityId, EvidenceId, IsoDateTime, VerificationStatus } from '@internet-brain-os/shared';
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
  readonly evidenceIds?: readonly EvidenceId[];
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

  async linkEvidence(id: EntityId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const updated: Entity = { ...current, updatedAt, evidenceIds: [...new Set([...current.evidenceIds, evidenceId])] };
    await this.repository.update(updated);
    return clone(updated);
  }

  async verify(id: EntityId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const evidenceIds = [...new Set([...current.evidenceIds, evidenceId])];
    const updated: Entity = {
      ...current,
      updatedAt,
      evidenceIds,
      verificationStatus: evidenceIds.length > 0 ? 'verified' : 'hypothesis',
    };
    await this.repository.update(updated);
    return clone(updated);
  }

  async unverify(id: EntityId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const evidenceIds = current.evidenceIds.filter((value) => value !== evidenceId);
    const updated: Entity = {
      ...current,
      updatedAt,
      evidenceIds,
      verificationStatus: evidenceIds.length > 0 ? 'hypothesis' : 'hypothesis',
    };
    await this.repository.update(updated);
    return clone(updated);
  }

  async addAlias(id: EntityId, alias: string, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const normalized = alias.trim();
    if (!normalized) throw new Error('alias is required');
    const aliases = new Set(current.aliases ?? []);
    if (aliases.has(normalized)) throw new Error(`Duplicate alias: ${normalized}`);
    aliases.add(normalized);
    const updated: Entity = { ...current, updatedAt, aliases: [...aliases] };
    await this.repository.update(updated);
    return clone(updated);
  }

  async removeAlias(id: EntityId, alias: string, updatedAt: IsoDateTime): Promise<Entity> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const normalized = alias.trim();
    const aliases = new Set(current.aliases ?? []);
    if (!aliases.has(normalized)) throw new Error(`Alias not found: ${normalized}`);
    aliases.delete(normalized);
    const updated: Entity = { ...current, updatedAt, aliases: [...aliases] };
    await this.repository.update(updated);
    return clone(updated);
  }

  async updateConfidence(id: EntityId, confidence: Confidence, updatedAt: IsoDateTime): Promise<Entity> {
    if (confidence < 0 || confidence > 1) throw new Error('confidence must be between 0 and 1');
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Entity not found: ${id}`);
    const updated: Entity = { ...current, updatedAt, confidence };
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
