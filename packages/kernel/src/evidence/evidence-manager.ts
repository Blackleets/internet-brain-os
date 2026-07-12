import type {
  CaseId,
  Confidence,
  EntityId,
  Evidence,
  EvidenceContentType,
  EvidenceId,
  IsoDateTime,
  RelationshipId,
} from '@internet-brain-os/shared';
import { CaseNotFoundError } from '../case';
import {
  ArchivedCaseEvidenceLinkError,
  EvidenceAlreadyExistsError,
  EvidenceNotFoundError,
  StaleEvidenceUpdateError,
} from './evidence-errors';
import {
  normalizeContentHash,
  normalizeEntityIds,
  normalizeOptionalText,
  normalizeRelationshipIds,
  normalizeSourceUrl,
  normalizeTags,
  validateConfidence,
} from './evidence-normalization';
import type {
  EvidenceCaseReader,
  EvidenceRecord,
  EvidenceRepository,
} from './evidence-repository';

export interface CreateEvidenceInput {
  readonly id: EvidenceId;
  readonly caseId?: CaseId;
  readonly sourceUrl?: string;
  readonly contentType: EvidenceContentType;
  readonly mimeType?: string;
  readonly contentRef?: string;
  readonly contentHash?: string;
  readonly rawText?: string;
  readonly summary?: string;
  readonly capturedAt: IsoDateTime;
  readonly extractionMethod?: string;
  readonly selector?: string;
  readonly confidence: Confidence;
  readonly tags?: readonly string[];
  readonly entityIds?: readonly EntityId[];
  readonly relationshipIds?: readonly RelationshipId[];
}

export interface UpdateEvidenceMetadataInput {
  readonly summary?: string | null;
  readonly confidence?: Confidence;
  readonly tags?: readonly string[];
  readonly entityIds?: readonly EntityId[];
  readonly relationshipIds?: readonly RelationshipId[];
  readonly caseId?: CaseId | null;
  readonly updatedAt: IsoDateTime;
}

export class EvidenceManager {
  constructor(
    private readonly repository: EvidenceRepository,
    private readonly caseReader: EvidenceCaseReader,
  ) {}

  async create(input: CreateEvidenceInput): Promise<Evidence> {
    if (await this.repository.getById(input.id)) {
      throw new EvidenceAlreadyExistsError(input.id);
    }
    if (input.caseId) await this.assertCaseAcceptsEvidence(input.id, input.caseId);

    const evidence: Evidence = {
      id: input.id,
      caseId: input.caseId,
      sourceUrl: normalizeSourceUrl(input.sourceUrl),
      contentType: input.contentType,
      mimeType: normalizeOptionalText(input.mimeType),
      contentRef: normalizeOptionalText(input.contentRef),
      contentHash: normalizeContentHash(input.contentHash),
      rawText: input.rawText,
      summary: normalizeOptionalText(input.summary),
      capturedAt: input.capturedAt,
      extractionMethod: normalizeOptionalText(input.extractionMethod),
      selector: normalizeOptionalText(input.selector),
      confidence: validateConfidence(input.confidence),
      tags: normalizeTags(input.tags),
      entityIds: normalizeEntityIds(input.entityIds),
      relationshipIds: normalizeRelationshipIds(input.relationshipIds),
    };

    await this.repository.create({ evidence, updatedAt: input.capturedAt });
    return cloneEvidence(evidence);
  }

  async getById(id: EvidenceId): Promise<Evidence | null> {
    const record = await this.repository.getById(id);
    return record ? cloneEvidence(record.evidence) : null;
  }

  async list(caseId?: CaseId): Promise<readonly Evidence[]> {
    return (await this.repository.list(caseId)).map((record) => cloneEvidence(record.evidence));
  }

  async updateMetadata(id: EvidenceId, input: UpdateEvidenceMetadataInput): Promise<Evidence> {
    const current = await this.requireRecord(id);
    this.assertFresh(current, input.updatedAt);
    const nextCaseId = input.caseId === undefined ? current.evidence.caseId : input.caseId ?? undefined;
    if (nextCaseId && nextCaseId !== current.evidence.caseId) {
      await this.assertCaseAcceptsEvidence(id, nextCaseId);
    }

    const updated: Evidence = {
      ...current.evidence,
      caseId: nextCaseId,
      summary: input.summary === undefined ? current.evidence.summary : normalizeOptionalText(input.summary),
      confidence: input.confidence === undefined ? current.evidence.confidence : validateConfidence(input.confidence),
      tags: input.tags === undefined ? [...current.evidence.tags] : normalizeTags(input.tags),
      entityIds: input.entityIds === undefined ? [...current.evidence.entityIds] : normalizeEntityIds(input.entityIds),
      relationshipIds: input.relationshipIds === undefined ? [...current.evidence.relationshipIds] : normalizeRelationshipIds(input.relationshipIds),
    };

    await this.repository.update({ evidence: updated, updatedAt: input.updatedAt });
    return cloneEvidence(updated);
  }

  attachToCase(id: EvidenceId, caseId: CaseId, updatedAt: IsoDateTime): Promise<Evidence> {
    return this.updateMetadata(id, { caseId, updatedAt });
  }

  detachFromCase(id: EvidenceId, updatedAt: IsoDateTime): Promise<Evidence> {
    return this.updateMetadata(id, { caseId: null, updatedAt });
  }

  async linkEntity(id: EvidenceId, entityId: EntityId, updatedAt: IsoDateTime): Promise<Evidence> {
    const current = await this.requireRecord(id);
    return this.updateMetadata(id, { entityIds: [...current.evidence.entityIds, entityId], updatedAt });
  }

  async unlinkEntity(id: EvidenceId, entityId: EntityId, updatedAt: IsoDateTime): Promise<Evidence> {
    const current = await this.requireRecord(id);
    return this.updateMetadata(id, {
      entityIds: current.evidence.entityIds.filter((value) => value !== entityId),
      updatedAt,
    });
  }

  async linkRelationship(id: EvidenceId, relationshipId: RelationshipId, updatedAt: IsoDateTime): Promise<Evidence> {
    const current = await this.requireRecord(id);
    return this.updateMetadata(id, {
      relationshipIds: [...current.evidence.relationshipIds, relationshipId],
      updatedAt,
    });
  }

  async unlinkRelationship(id: EvidenceId, relationshipId: RelationshipId, updatedAt: IsoDateTime): Promise<Evidence> {
    const current = await this.requireRecord(id);
    return this.updateMetadata(id, {
      relationshipIds: current.evidence.relationshipIds.filter((value) => value !== relationshipId),
      updatedAt,
    });
  }

  private async requireRecord(id: EvidenceId): Promise<EvidenceRecord> {
    const record = await this.repository.getById(id);
    if (!record) throw new EvidenceNotFoundError(id);
    return record;
  }

  private assertFresh(record: EvidenceRecord, updatedAt: IsoDateTime): void {
    if (updatedAt <= record.updatedAt) {
      throw new StaleEvidenceUpdateError(record.evidence.id, updatedAt, record.updatedAt);
    }
  }

  private async assertCaseAcceptsEvidence(evidenceId: EvidenceId, caseId: CaseId): Promise<void> {
    const caseRecord = await this.caseReader.getById(caseId);
    if (!caseRecord) throw new CaseNotFoundError(caseId);
    if (caseRecord.status === 'archived') {
      throw new ArchivedCaseEvidenceLinkError(evidenceId, caseId);
    }
  }
}

function cloneEvidence(evidence: Evidence): Evidence {
  return {
    ...evidence,
    tags: [...evidence.tags],
    entityIds: [...evidence.entityIds],
    relationshipIds: [...evidence.relationshipIds],
  };
}
