import type { Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import type { Memory, MemoryId, MemoryKind, MemoryRepository } from './memory-repository';

export interface CreateMemoryInput {
  readonly id: MemoryId;
  readonly kind: MemoryKind;
  readonly subject: string;
  readonly content: string;
  readonly confidence: Confidence;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly createdAt: IsoDateTime;
}

export class MemoryManager {
  constructor(private readonly repository: MemoryRepository) {}

  async create(input: CreateMemoryInput): Promise<Memory> {
    if (await this.repository.getById(input.id)) throw new Error(`Memory already exists: ${input.id}`);
    const memory: Memory = {
      id: input.id,
      kind: input.kind,
      subject: required(input.subject, 'subject'),
      content: required(input.content, 'content'),
      confidence: input.confidence,
      evidenceIds: [...new Set(input.evidenceIds ?? [])],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    await this.repository.create(memory);
    return clone(memory);
  }

  getById(id: MemoryId): Promise<Memory | null> { return this.repository.getById(id); }
  list(): Promise<readonly Memory[]> { return this.repository.list(); }

  async attachEvidence(id: MemoryId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Memory> {
    const current = await this.repository.getById(id);
    if (!current) throw new Error(`Memory not found: ${id}`);
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

function clone(memory: Memory): Memory { return { ...memory, evidenceIds: [...memory.evidenceIds] }; }
