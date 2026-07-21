import type { Confidence, EvidenceId, IsoDateTime } from '@internet-brain-os/shared';
import {
  ArchivedMemoryMutationError,
  InvalidMemoryInputError,
  MemoryAlreadyExistsError,
  MemoryNotFoundError,
  StaleMemoryUpdateError,
} from './memory-errors';
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

export interface UpdateMemoryInput {
  readonly kind?: MemoryKind;
  readonly subject?: string;
  readonly content?: string;
  readonly confidence?: Confidence;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly updatedAt: IsoDateTime;
}

export interface MemoryReadOptions {
  readonly includeArchived?: boolean;
}

export class MemoryManager {
  constructor(private readonly repository: MemoryRepository) {}

  async create(input: CreateMemoryInput): Promise<Memory> {
    if (await this.repository.getById(input.id)) throw new MemoryAlreadyExistsError(input.id);
    const memory: Memory = {
      id: input.id,
      kind: input.kind,
      subject: required(input.subject, 'subject'),
      content: required(input.content, 'content'),
      confidence: validateConfidence(input.confidence),
      evidenceIds: unique(input.evidenceIds ?? []),
      status: 'active',
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    };
    await this.repository.create(memory);
    return clone(memory);
  }

  async getById(id: MemoryId, options: MemoryReadOptions = {}): Promise<Memory | null> {
    const memory = await this.repository.getById(id);
    if (!memory || (memory.status === 'archived' && !options.includeArchived)) return null;
    return clone(memory);
  }

  async list(options: MemoryReadOptions = {}): Promise<readonly Memory[]> {
    return (await this.repository.list())
      .filter((memory) => options.includeArchived || memory.status !== 'archived')
      .map(clone);
  }

  async update(id: MemoryId, input: UpdateMemoryInput): Promise<Memory> {
    const current = await this.requireMemory(id);
    this.assertMutable(current);
    this.assertFresh(current, input.updatedAt);

    const updated: Memory = {
      ...current,
      kind: input.kind ?? current.kind,
      subject: input.subject === undefined ? current.subject : required(input.subject, 'subject'),
      content: input.content === undefined ? current.content : required(input.content, 'content'),
      confidence: input.confidence === undefined ? current.confidence : validateConfidence(input.confidence),
      evidenceIds: input.evidenceIds === undefined ? [...current.evidenceIds] : unique(input.evidenceIds),
      updatedAt: input.updatedAt,
    };

    await this.repository.update(updated);
    return clone(updated);
  }

  async attachEvidence(id: MemoryId, evidenceId: EvidenceId, updatedAt: IsoDateTime): Promise<Memory> {
    const current = await this.requireMemory(id);
    return this.update(id, { evidenceIds: [...current.evidenceIds, evidenceId], updatedAt });
  }

  async archive(id: MemoryId, updatedAt: IsoDateTime): Promise<Memory> {
    const current = await this.requireMemory(id);
    this.assertMutable(current);
    this.assertFresh(current, updatedAt);
    const archived: Memory = { ...current, evidenceIds: [...current.evidenceIds], status: 'archived', updatedAt };
    await this.repository.update(archived);
    return clone(archived);
  }

  private async requireMemory(id: MemoryId): Promise<Memory> {
    const current = await this.repository.getById(id);
    if (!current) throw new MemoryNotFoundError(id);
    return current;
  }

  private assertMutable(memory: Memory): void {
    if (memory.status === 'archived') throw new ArchivedMemoryMutationError(memory.id);
  }

  private assertFresh(memory: Memory, updatedAt: IsoDateTime): void {
    if (updatedAt <= memory.updatedAt) throw new StaleMemoryUpdateError(memory.id, updatedAt, memory.updatedAt);
  }
}

function required(value: string, field: 'subject' | 'content'): string {
  const normalized = value.trim();
  if (!normalized) throw new InvalidMemoryInputError(field, value, `${field} is required`);
  return normalized;
}

function validateConfidence(value: Confidence): Confidence {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new InvalidMemoryInputError('confidence', value, 'confidence must be between 0 and 1');
  }
  return value;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function clone(memory: Memory): Memory { return { ...memory, evidenceIds: [...memory.evidenceIds] }; }
