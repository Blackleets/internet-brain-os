import type { IsoDateTime } from '@internet-brain-os/shared';
import type { MemoryId } from './memory-repository';

export type InvalidMemoryInputField = 'subject' | 'content' | 'confidence' | 'timestamp' | 'origin' | 'sourceMemoryIds';

export class MemoryAlreadyExistsError extends Error {
  readonly code = 'MEMORY_ALREADY_EXISTS';
  constructor(readonly memoryId: MemoryId) {
    super(`Memory with id ${memoryId} already exists`);
    this.name = 'MemoryAlreadyExistsError';
  }
}

export class MemoryNotFoundError extends Error {
  readonly code = 'MEMORY_NOT_FOUND';
  constructor(readonly memoryId: MemoryId) {
    super(`Memory with id ${memoryId} not found`);
    this.name = 'MemoryNotFoundError';
  }
}

export class InvalidMemoryInputError extends Error {
  readonly code = 'INVALID_MEMORY_INPUT';
  constructor(readonly field: InvalidMemoryInputField, readonly value: unknown, message: string) {
    super(message);
    this.name = 'InvalidMemoryInputError';
  }
}

export class ArchivedMemoryMutationError extends Error {
  readonly code = 'ARCHIVED_MEMORY_MUTATION';
  constructor(readonly memoryId: MemoryId) {
    super(`Cannot mutate archived memory ${memoryId}`);
    this.name = 'ArchivedMemoryMutationError';
  }
}

export class StaleMemoryUpdateError extends Error {
  readonly code = 'STALE_MEMORY_UPDATE';
  constructor(readonly memoryId: MemoryId, readonly provided: IsoDateTime, readonly stored: IsoDateTime) {
    super(`Stale update for memory ${memoryId}: provided ${provided}, stored ${stored}`);
    this.name = 'StaleMemoryUpdateError';
  }
}
