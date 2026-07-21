import type { Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';

export type MemoryId = string & { readonly __brand: 'MemoryId' };

export type MemoryKind = 'fact' | 'observation' | 'hypothesis' | 'decision' | 'lesson';
export type MemoryStatus = 'active' | 'archived';

export interface Memory {
  readonly id: MemoryId;
  readonly kind: MemoryKind;
  readonly subject: string;
  readonly content: string;
  readonly confidence: Confidence;
  readonly evidenceIds: readonly EvidenceId[];
  readonly status: MemoryStatus;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface MemoryRepository {
  create(memory: Memory): Promise<void>;
  getById(id: MemoryId): Promise<Memory | null>;
  list(): Promise<readonly Memory[]>;
  update(memory: Memory): Promise<void>;
}
