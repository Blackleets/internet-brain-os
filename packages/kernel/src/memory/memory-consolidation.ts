import type { Confidence, IsoDateTime } from '@internet-brain-os/shared';
import type { Memory, MemoryId } from './memory-repository';

export interface MemoryConsolidationGroup {
  readonly canonical: Memory;
  readonly sourceMemoryIds: readonly MemoryId[];
}

export interface MemoryConsolidationOptions {
  readonly similarityThreshold?: number;
}

/**
 * Conservative consolidation of semantically identical memory records.
 * The engine only consolidates exact normalized content matches and never
 * silently discards provenance: source IDs are returned with the canonical memory.
 */
export class MemoryConsolidationEngine {
  constructor(private readonly options: MemoryConsolidationOptions = {}) {}

  consolidate(memories: readonly Memory[]): readonly MemoryConsolidationGroup[] {
    const groups = new Map<string, MemoryConsolidationGroup>();

    for (const memory of memories) {
      const key = normalize(memory.content);
      const existing = groups.get(key);

      if (!existing) {
        groups.set(key, {
          canonical: memory,
          sourceMemoryIds: [memory.id],
        });
        continue;
      }

      groups.set(key, {
        canonical: chooseCanonical(existing.canonical, memory),
        sourceMemoryIds: [...new Set([...existing.sourceMemoryIds, memory.id])],
      });
    }

    return [...groups.values()];
  }
}

function chooseCanonical(left: Memory, right: Memory): Memory {
  if (confidence(right.confidence) > confidence(left.confidence)) return right;
  if (right.updatedAt > left.updatedAt) return right;
  return left;
}

function confidence(value: Confidence): number {
  return Number(value);
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
