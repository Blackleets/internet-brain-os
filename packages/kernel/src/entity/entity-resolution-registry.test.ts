import { describe, expect, it } from 'vitest';
import { InMemoryEntityResolutionRegistry } from './entity-resolution-registry';

describe('InMemoryEntityResolutionRegistry', () => {
  it('records immutable snapshots and filters by canonical entity', () => {
    const registry = new InMemoryEntityResolutionRegistry();
    const record = {
      entityId: 'entity:openai',
      action: 'link' as const,
      score: 0.98,
      reasons: ['exact_name_or_alias'],
      decidedAt: '2026-07-17T00:00:00.000Z',
      inputName: 'OpenAI Inc.',
      inputType: 'organization',
      createdAt: '2026-07-17T00:00:00.000Z',
    };

    registry.record(record);
    record.reasons.push('mutated_after_record');

    expect(registry.list()).toEqual([{
      ...record,
      reasons: ['exact_name_or_alias'],
    }]);
    expect(registry.forEntity('entity:openai')).toHaveLength(1);
    expect(registry.forEntity('entity:other')).toHaveLength(0);
  });
});
