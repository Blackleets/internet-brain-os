import { describe, expect, it } from 'vitest';
import { InMemoryCaseRepository, InMemoryMemoryRepository } from './in-memory';
import { MemoryManager } from '../memory';

describe('in-memory persistence', () => {
  it('stores and returns isolated case records', async () => {
    const repository = new InMemoryCaseRepository();
    const record = {
      id: 'case:test' as never,
      title: 'Test Case',
      objective: 'Validate persistence',
      status: 'active' as never,
      tags: ['test'],
      createdAt: '2026-01-01T00:00:00.000Z' as never,
      updatedAt: '2026-01-01T00:00:00.000Z' as never,
    };
    await repository.create(record);
    const loaded = await repository.getById(record.id);
    expect(loaded).toEqual(record);
    expect(loaded).not.toBe(record);
  });

  it('creates evidence-linked institutional memory', async () => {
    const manager = new MemoryManager(new InMemoryMemoryRepository());
    const memory = await manager.create({
      id: 'memory:test' as never,
      kind: 'fact',
      subject: 'Test subject',
      content: 'A traceable fact.',
      confidence: 0.9 as never,
      evidenceIds: ['evidence:test' as never],
      createdAt: '2026-01-01T00:00:00.000Z' as never,
    });
    expect(memory.evidenceIds).toEqual(['evidence:test']);
    expect(await manager.getById(memory.id)).toEqual(memory);
  });
});
