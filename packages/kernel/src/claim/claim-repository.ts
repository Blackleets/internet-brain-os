import type { Claim, ClaimId } from '@internet-brain-os/shared';

export interface ClaimRepository {
  create(claim: Claim): Promise<void>;
  getById(id: ClaimId): Promise<Claim | null>;
  list(): Promise<readonly Claim[]>;
  update(claim: Claim): Promise<void>;
}
