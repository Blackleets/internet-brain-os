import type { EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { Memory, MemoryId } from './memory-repository';

export interface MemoryProvenance {
  readonly memoryId: MemoryId;
  readonly sourceMemoryIds: readonly MemoryId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly consolidatedAt: IsoDateTime;
}

export interface MemoryWithProvenance {
  readonly memory: Memory;
  readonly provenance: MemoryProvenance;
}

/** Merges provenance without duplicates and without mutating source records. */
export function mergeMemoryProvenance(
  canonical: Memory,
  sourceMemories: readonly Memory[],
  consolidatedAt: IsoDateTime,
): MemoryWithProvenance {
  const sourceMemoryIds = [...new Set(sourceMemories.map((memory) => memory.id))];
  const evidenceIds = [...new Set(sourceMemories.flatMap((memory) => memory.evidenceIds))];

  return {
    memory: { ...canonical },
    provenance: {
      memoryId: canonical.id,
      sourceMemoryIds,
      evidenceIds,
      consolidatedAt,
    },
  };
}
