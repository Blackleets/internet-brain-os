import { describe, expect, it } from 'vitest';
import { ClaimExtractionEngine } from './claim-extraction';
import { ClaimManager } from './claim-manager';
import { InMemoryClaimRepository } from '../storage/in-memory';

describe('ClaimExtractionEngine', () => {
  it('creates traceable reported claims from explicit evidence', async () => {
    const manager = new ClaimManager(new InMemoryClaimRepository());
    const engine = new ClaimExtractionEngine(manager);
    const result = await engine.extract([
      {
        id: 'evidence:1' as never,
        caseId: 'case:1' as never,
        sourceUrl: 'https://example.com',
        contentType: 'webpage',
        summary: 'Entity A acquired Entity B.',
        rawText: 'Entity A acquired Entity B.',
        confidence: 0.9 as never,
        tags: [],
        entityIds: [],
        relationshipIds: [],
      } as never,
    ], {
      idFactory: () => 'claim:1' as never,
      now: '2026-01-01T00:00:00.000Z' as never,
    });
    expect(result.claimIds).toEqual(['claim:1']);
    expect((await manager.getById('claim:1' as never))?.evidenceIds).toEqual(['evidence:1']);
  });
});
