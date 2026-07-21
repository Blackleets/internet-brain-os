import type { CaseId, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import { InvalidMemoryInputError } from './memory-errors';
import type { Memory, MemoryId } from './memory-repository';

export interface MemoryProvenance {
  readonly memoryId: MemoryId;
  readonly origin: string;
  readonly sourceMemoryIds: readonly MemoryId[];
  readonly caseIds: readonly CaseId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly parentProvenanceIds: readonly string[];
  readonly consolidatedAt: IsoDateTime;
}

export interface MemoryProvenanceInput {
  readonly origin?: string;
  readonly caseIds?: readonly CaseId[];
  readonly parentProvenanceIds?: readonly string[];
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
  input: MemoryProvenanceInput = {},
): MemoryWithProvenance {
  if (sourceMemories.length === 0) {
    throw new InvalidMemoryInputError('sourceMemoryIds', sourceMemories, 'at least one source memory is required');
  }
  if (!String(consolidatedAt).trim()) {
    throw new InvalidMemoryInputError('timestamp', consolidatedAt, 'provenance timestamp is required');
  }
  const origin = (input.origin ?? 'memory-consolidation').trim();
  if (!origin) throw new InvalidMemoryInputError('origin', input.origin, 'provenance origin is required');

  const sourceMemoryIds = [...new Set(sourceMemories.map((memory) => memory.id))];
  if (!sourceMemoryIds.includes(canonical.id)) {
    throw new InvalidMemoryInputError('sourceMemoryIds', sourceMemoryIds, 'canonical memory must be included in the source memory chain');
  }

  const evidenceIds = [...new Set(sourceMemories.flatMap((memory) => memory.evidenceIds))];

  return {
    memory: { ...canonical, evidenceIds: [...canonical.evidenceIds] },
    provenance: {
      memoryId: canonical.id,
      origin,
      sourceMemoryIds,
      caseIds: [...new Set(input.caseIds ?? [])],
      evidenceIds,
      parentProvenanceIds: [...new Set(input.parentProvenanceIds ?? [])],
      consolidatedAt,
    },
  };
}
