import type { EntityId, IsoDateTime } from '@internet-brain-os/shared';
import type {
  AuditableEntityResolutionDecision,
  EntityResolutionAction,
} from './entity-resolution-decision';

export interface EntityResolutionRecord extends AuditableEntityResolutionDecision {
  readonly inputName: string;
  readonly inputType?: string;
  readonly createdAt: IsoDateTime;
}

export interface EntityResolutionRegistry {
  record(record: EntityResolutionRecord): void;
  list(): readonly EntityResolutionRecord[];
  forEntity(entityId: EntityId): readonly EntityResolutionRecord[];
}

/** In-memory audit registry. Persistence can be added without changing the contract. */
export class InMemoryEntityResolutionRegistry implements EntityResolutionRegistry {
  private readonly records: EntityResolutionRecord[] = [];

  record(record: EntityResolutionRecord): void {
    this.records.push({
      ...record,
      reasons: [...record.reasons],
    });
  }

  list(): readonly EntityResolutionRecord[] {
    return this.records.map((record) => ({ ...record, reasons: [...record.reasons] }));
  }

  forEntity(entityId: EntityId): readonly EntityResolutionRecord[] {
    return this.list().filter((record) => record.entityId === entityId);
  }
}

export function isResolutionAction(action: string): action is EntityResolutionAction {
  return action === 'link' || action === 'review' || action === 'create';
}
