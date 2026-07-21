import type { Case, CaseId, Claim, ClaimId, Entity, EntityId, EvidenceId, Relationship, RelationshipId } from '@internet-brain-os/shared';
import type { CaseRepository } from '../case';
import type { ClaimRepository } from '../claim';
import type { EvidenceRecord, EvidenceRepository } from '../evidence';
import type { EntityRepository } from '../entity';
import type { RelationshipRepository } from '../relationship';
import type { Memory, MemoryId, MemoryRepository } from '../memory';

export class InMemoryCaseRepository implements CaseRepository {
  private readonly records = new Map<CaseId, Case>();
  async create(caseRecord: Case): Promise<void> { this.records.set(caseRecord.id, cloneCase(caseRecord)); }
  async getById(id: CaseId): Promise<Case | null> { const record = this.records.get(id); return record ? cloneCase(record) : null; }
  async list(): Promise<readonly Case[]> { return [...this.records.values()].map(cloneCase); }
  async update(caseRecord: Case): Promise<void> { this.records.set(caseRecord.id, cloneCase(caseRecord)); }
}

export class InMemoryClaimRepository implements ClaimRepository {
  private readonly records = new Map<ClaimId, Claim>();
  async create(claim: Claim): Promise<void> { this.records.set(claim.id, cloneClaim(claim)); }
  async getById(id: ClaimId): Promise<Claim | null> { const record = this.records.get(id); return record ? cloneClaim(record) : null; }
  async list(): Promise<readonly Claim[]> { return [...this.records.values()].map(cloneClaim); }
  async update(claim: Claim): Promise<void> { this.records.set(claim.id, cloneClaim(claim)); }
}

export class InMemoryEvidenceRepository implements EvidenceRepository {
  private readonly records = new Map<EvidenceId, EvidenceRecord>();
  async create(record: EvidenceRecord): Promise<void> { this.records.set(record.evidence.id, cloneEvidenceRecord(record)); }
  async getById(id: EvidenceId): Promise<EvidenceRecord | null> { const record = this.records.get(id); return record ? cloneEvidenceRecord(record) : null; }
  async list(caseId?: CaseId): Promise<readonly EvidenceRecord[]> { return [...this.records.values()].filter((record) => caseId === undefined || record.evidence.caseId === caseId).map(cloneEvidenceRecord); }
  async update(record: EvidenceRecord): Promise<void> { this.records.set(record.evidence.id, cloneEvidenceRecord(record)); }
}

export class InMemoryEntityRepository implements EntityRepository {
  private readonly records = new Map<EntityId, Entity>();
  async create(entity: Entity): Promise<void> { this.records.set(entity.id, cloneEntity(entity)); }
  async getById(id: EntityId): Promise<Entity | null> { const record = this.records.get(id); return record ? cloneEntity(record) : null; }
  async list(): Promise<readonly Entity[]> { return [...this.records.values()].map(cloneEntity); }
  async update(entity: Entity): Promise<void> { this.records.set(entity.id, cloneEntity(entity)); }
}

export class InMemoryRelationshipRepository implements RelationshipRepository {
  private readonly records = new Map<RelationshipId, Relationship>();
  async create(relationship: Relationship): Promise<void> { this.records.set(relationship.id, cloneRelationship(relationship)); }
  async getById(id: RelationshipId): Promise<Relationship | null> { const record = this.records.get(id); return record ? cloneRelationship(record) : null; }
  async list(): Promise<readonly Relationship[]> { return [...this.records.values()].map(cloneRelationship); }
  async update(relationship: Relationship): Promise<void> { this.records.set(relationship.id, cloneRelationship(relationship)); }
}

export class InMemoryMemoryRepository implements MemoryRepository {
  private readonly records = new Map<MemoryId, Memory>();
  async create(memory: Memory): Promise<void> { this.records.set(memory.id, cloneMemory(memory)); }
  async getById(id: MemoryId): Promise<Memory | null> { const record = this.records.get(id); return record ? cloneMemory(record) : null; }
  async list(): Promise<readonly Memory[]> { return [...this.records.values()].map(cloneMemory); }
  async update(memory: Memory): Promise<void> { this.records.set(memory.id, cloneMemory(memory)); }
}

function cloneCase(record: Case): Case { return { ...record, tags: [...record.tags] }; }
function cloneClaim(claim: Claim): Claim { return { ...claim, evidenceIds: [...claim.evidenceIds], contradictsClaimIds: [...claim.contradictsClaimIds] }; }
function cloneEvidenceRecord(record: EvidenceRecord): EvidenceRecord { return { updatedAt: record.updatedAt, evidence: { ...record.evidence, tags: [...record.evidence.tags], entityIds: [...record.evidence.entityIds], relationshipIds: [...record.evidence.relationshipIds] } }; }
function cloneEntity(entity: Entity): Entity { return { ...entity, aliases: entity.aliases ? [...entity.aliases] : undefined, properties: { ...entity.properties }, evidenceIds: [...entity.evidenceIds] }; }
function cloneRelationship(relationship: Relationship): Relationship { return { ...relationship, evidenceIds: [...relationship.evidenceIds] }; }
function cloneMemory(memory: Memory): Memory { return { ...memory, evidenceIds: [...memory.evidenceIds] }; }
