import type { Claim, ClaimId, ClaimStatus, Confidence, EntityId, EvidenceId, IsoDateTime, VerificationStatus } from '@internet-brain-os/shared';
import type { ClaimRepository } from './claim-repository';

export interface CreateClaimInput {
  readonly id: ClaimId;
  readonly statement: string;
  readonly status?: ClaimStatus;
  readonly subjectEntityId?: EntityId;
  readonly objectEntityId?: EntityId;
  readonly confidence: Confidence;
  readonly verificationStatus?: VerificationStatus;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly contradictsClaimIds?: readonly ClaimId[];
  readonly createdAt: IsoDateTime;
}

export class ClaimManager {
  constructor(private readonly repository: ClaimRepository) {}

  async create(input: CreateClaimInput): Promise<Claim> {
    if (await this.repository.getById(input.id)) throw new Error(`Claim already exists: ${input.id}`);
    const claim: Claim = {
      id: input.id,
      statement: required(input.statement, 'statement'),
      status: input.status ?? 'observed',
      subjectEntityId: input.subjectEntityId,
      objectEntityId: input.objectEntityId,
      confidence: input.confidence,
      verificationStatus: input.verificationStatus ?? 'hypothesis',
      evidenceIds: unique(input.evidenceIds ?? []),
      contradictsClaimIds: unique(input.contradictsClaimIds ?? []),
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    await this.repository.create(claim);
    return clone(claim);
  }

  async addEvidence(id: ClaimId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Claim> {
    const current = await this.require(id);
    const updated = { ...current, evidenceIds: unique([...current.evidenceIds, evidenceId]), updatedAt };
    await this.repository.update(updated);
    return clone(updated);
  }

  async addContradiction(id: ClaimId, contradictsClaimId: ClaimId, updatedAt: IsoDateTime): Promise<Claim> {
    if (id === contradictsClaimId) throw new Error('A claim cannot contradict itself');
    const current = await this.require(id);
    const updated = { ...current, contradictsClaimIds: unique([...current.contradictsClaimIds, contradictsClaimId]), updatedAt };
    await this.repository.update(updated);
    return clone(updated);
  }

  getById(id: ClaimId): Promise<Claim | null> { return this.repository.getById(id); }
  list(): Promise<readonly Claim[]> { return this.repository.list(); }

  private async require(id: ClaimId): Promise<Claim> {
    const claim = await this.repository.getById(id);
    if (!claim) throw new Error(`Claim not found: ${id}`);
    return claim;
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function unique<T>(values: readonly T[]): readonly T[] { return [...new Set(values)]; }
function clone(claim: Claim): Claim { return { ...claim, evidenceIds: [...claim.evidenceIds], contradictsClaimIds: [...claim.contradictsClaimIds] }; }
