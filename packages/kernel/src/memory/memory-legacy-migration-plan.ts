import type { MemoryAuthorityReconciliationReport } from './memory-authority-reconciliation';
import type { Memory } from './memory-repository';

export type LegacyMemoryMigrationAction = 'no_action' | 'plan_migration' | 'blocked';

export interface LegacyMemoryMigrationPlanEntry {
  readonly memoryId: string;
  readonly action: LegacyMemoryMigrationAction;
  readonly reason: string;
  readonly proposedInitialState?: 'proposed';
  readonly requiredEvidenceIds: readonly string[];
}

export interface LegacyMemoryMigrationPlan {
  readonly mode: 'dry_run';
  readonly entries: readonly LegacyMemoryMigrationPlanEntry[];
  readonly counts: Readonly<Record<LegacyMemoryMigrationAction, number>>;
}

export function planLegacyMemoryMigration(
  memories: readonly Memory[],
  reconciliation: MemoryAuthorityReconciliationReport,
): LegacyMemoryMigrationPlan {
  const reconciliationById = new Map<string, typeof reconciliation.entries[number]>();
  const duplicateIds = duplicates(reconciliation.entries.map((entry) => entry.memoryId.trim()));

  for (const entry of reconciliation.entries) {
    const memoryId = entry.memoryId.trim();
    if (!reconciliationById.has(memoryId)) reconciliationById.set(memoryId, entry);
  }

  const duplicateMemoryIds = duplicates(memories.map((memory) => String(memory.id).trim()));
  const entries = memories.map((memory): LegacyMemoryMigrationPlanEntry => {
    const memoryId = String(memory.id).trim();
    const authority = reconciliationById.get(memoryId);

    if (!memoryId || duplicateMemoryIds.has(memoryId) || duplicateIds.has(memoryId)) {
      return blocked(memoryId, 'Memory identity is empty or ambiguous.', memory.evidenceIds);
    }

    if (!authority) {
      return blocked(memoryId, 'Memory is absent from startup reconciliation.', memory.evidenceIds);
    }

    if (authority.status === 'migration_required') {
      return {
        memoryId,
        action: 'plan_migration',
        reason: 'Legacy memory has no authority receipt chain and requires an explicit reviewed migration.',
        proposedInitialState: 'proposed',
        requiredEvidenceIds: sortedUnique(memory.evidenceIds.map(String)),
      };
    }

    if (authority.status !== 'valid') {
      return blocked(memoryId, `Authority reconciliation status ${authority.status} must be resolved before migration.`, memory.evidenceIds);
    }

    return {
      memoryId,
      action: 'no_action',
      reason: 'Memory already has a valid authority chain.',
      requiredEvidenceIds: sortedUnique(memory.evidenceIds.map(String)),
    };
  });

  const counts: Record<LegacyMemoryMigrationAction, number> = {
    no_action: 0,
    plan_migration: 0,
    blocked: 0,
  };
  for (const entry of entries) counts[entry.action] += 1;

  return {
    mode: 'dry_run',
    entries: entries.map((entry) => ({ ...entry, requiredEvidenceIds: [...entry.requiredEvidenceIds] })),
    counts: { ...counts },
  };
}

function blocked(memoryId: string, reason: string, evidenceIds: readonly unknown[]): LegacyMemoryMigrationPlanEntry {
  return {
    memoryId,
    action: 'blocked',
    reason,
    requiredEvidenceIds: sortedUnique(evidenceIds.map(String)),
  };
}

function duplicates(values: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const duplicatesFound = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicatesFound.add(value);
    seen.add(value);
  }
  return duplicatesFound;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}
