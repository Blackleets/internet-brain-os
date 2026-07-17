import { describe, expect, it } from 'vitest';
import { ClaimManager } from './claim-manager';
import { InMemoryClaimRepository } from '../storage/in-memory';

describe('ClaimManager', () => {
  it('creates a provenance-aware claim with unique evidence', async () => {
    const manager = new ClaimManager(new InMemoryClaimRepository());
    const claim = await manager.create({
      id: 'claim:test' as never,
      statement: 'Entity A acquired Entity B',
      confidence: 0.8 as never,
      evidenceIds: ['evidence:1' as never, 'evidence:1' as never],
      createdAt: '2026-01-01T00:00:00.000Z' as never,
    });
    expect(claim.evidenceIds).toEqual(['evidence:1']);
    expect(claim.status).toBe('observed');
  });

  it('rejects self-contradiction', async () => {
    const manager = new ClaimManager(new InMemoryClaimRepository());
    await manager.create({
      id: 'claim:test' as never,
      statement: 'A claim',
      confidence: 0.5 as never,
      createdAt: '2026-01-01T00:00:00.000Z' as never,
    });
    await expect(manager.addContradiction('claim:test' as never, 'claim:test' as never, '2026-01-01T00:00:01.000Z' as never)).rejects.toThrow('cannot contradict itself');
  });
});
