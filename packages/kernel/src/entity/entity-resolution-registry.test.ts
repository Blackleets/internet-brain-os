import { describe, expect, it } from 'vitest';
import type { EntityId, IsoDateTime } from '@internet-brain-os/shared';
import { InMemoryEntityResolutionRegistry } from './entity-resolution-registry';

const entityId = 'entity:openai' as EntityId;
const otherEntityId = 'entity:other' as EntityId;
const decidedAt = '2026-07-17T00:00:00.000Z' as IsoDateTime;

describe('InMemoryEntityResolutionRegistry', () => {
  it('records immutable snapshots and filters by canonical entity', () => {
    const registry = new InMemoryEntityResolutionRegistry();
    const record = {
      entityId,
      action: 'link' as const,
      score: 0.98,
      reasons: ['exact_name_or_alias'],
      decidedAt,
      inputName: 'OpenAI Inc.',
      inputType: 'organization',
      createdAt: decidedAt,
    };

    registry.record(record);
    record.reasons.push('mutated_after_record');

    expect(registry.list()).toEqual([{
      ...record,
      reasons: ['exact_name_or_alias'],
    }]);
    expect(registry.forEntity(entityId)).toHaveLength(1);
    expect(registry.forEntity(otherEntityId)).toHaveLength(0);
  });
});
