import { describe, expect, it } from 'vitest';
import { planLegacyMemoryMigration } from './memory-legacy-migration-plan';
import type { MemoryAuthorityReconciliationReport } from './memory-authority-reconciliation';
import type { Memory } from './memory-repository';

const memory = (id: string, evidenceIds: string[] = []): Memory => ({
  id: id as Memory['id'],
  kind: 'fact',
  subject: 'subject',
  content: 'content',
  confidence: 0.9 as Memory['confidence'],
  evidenceIds: evidenceIds as Memory['evidenceIds'],
  createdAt: '2026-08-03T00:00:00.000Z' as Memory['createdAt'],
  updatedAt: '2026-08-03T00:00:00.000Z' as Memory['updatedAt'],
});

const report = (entries: MemoryAuthorityReconciliationReport['entries']): MemoryAuthorityReconciliationReport => ({
  status: 'complete',
  entries,
  counts: {
    valid: entries.filter((entry) => entry.status === 'valid').length,
    missing_reference: entries.filter((entry) => entry.status === 'missing_reference').length,
    integrity_failure: entries.filter((entry) => entry.status === 'integrity_failure').length,
    ambiguous_chain: entries.filter((entry) => entry.status === 'ambiguous_chain').length,
    migration_required: entries.filter((entry) => entry.status === 'migration_required').length,
  },
});

const entry = (memoryId: string, status: MemoryAuthorityReconciliationReport['entries'][number]['status']) => ({
  memoryId,
  status,
  reusable: false,
  projection: {
    status: 'blocked' as const,
    memoryId,
    failureCode: 'EMPTY_CHAIN' as const,
    message: 'empty',
  },
  missingReferenceIds: [],
  reason: status,
});

describe('planLegacyMemoryMigration', () => {
  it('plans legacy memory as proposed without writing or admitting it', () => {
    const result = planLegacyMemoryMigration(
      [memory('memory-1', ['evidence-2', 'evidence-1', 'evidence-1'])],
      report([entry('memory-1', 'migration_required')]),
    );

    expect(result.mode).toBe('dry_run');
    expect(result.entries[0]).toEqual({
      memoryId: 'memory-1',
      action: 'plan_migration',
      reason: expect.stringContaining('explicit reviewed migration'),
      proposedInitialState: 'proposed',
      requiredEvidenceIds: ['evidence-1', 'evidence-2'],
    });
  });

  it('takes no action for a valid authority chain', () => {
    const result = planLegacyMemoryMigration([memory('memory-1')], report([entry('memory-1', 'valid')]));
    expect(result.entries[0]?.action).toBe('no_action');
  });

  it('blocks unresolved reconciliation failures', () => {
    const result = planLegacyMemoryMigration(
      [memory('memory-1')],
      report([entry('memory-1', 'integrity_failure')]),
    );
    expect(result.entries[0]?.action).toBe('blocked');
  });

  it('blocks memories absent from reconciliation', () => {
    const result = planLegacyMemoryMigration([memory('memory-1')], report([]));
    expect(result.entries[0]?.action).toBe('blocked');
  });

  it('blocks duplicate memory identities', () => {
    const result = planLegacyMemoryMigration(
      [memory('memory-1'), memory('memory-1')],
      report([entry('memory-1', 'migration_required')]),
    );
    expect(result.entries.every((item) => item.action === 'blocked')).toBe(true);
  });

  it('returns defensive evidence arrays', () => {
    const result = planLegacyMemoryMigration(
      [memory('memory-1', ['evidence-1'])],
      report([entry('memory-1', 'migration_required')]),
    );
    const evidence = result.entries[0]?.requiredEvidenceIds as string[];
    evidence.push('tampered');

    const next = planLegacyMemoryMigration(
      [memory('memory-1', ['evidence-1'])],
      report([entry('memory-1', 'migration_required')]),
    );
    expect(next.entries[0]?.requiredEvidenceIds).toEqual(['evidence-1']);
  });
});
