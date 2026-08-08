import { describe, expect, test } from 'vitest';
import { TriggerDefinitionError, TriggerEngine, type TriggerEventStore } from './trigger-engine';
import type { TriggerDefinition, TriggerEvent } from './trigger-contract';

const createdAt = '2026-08-08T14:00:00.000Z';
function definition(condition: TriggerDefinition['condition'], overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    id: 'trigger:1', goalId: 'goal:1', planId: 'plan:1', revisionId: 'plan:1:rev:1',
    condition, enabled: true, createdAt, ...overrides,
  };
}
function store(): TriggerEventStore {
  let events: TriggerEvent[] = [];
  return {
    transaction: async (callback) => callback(events),
    write: async (next) => { events = next.map((event) => ({ ...event })); },
  };
}
const observedAt = '2026-08-08T15:00:00.000Z';

describe('TriggerEngine', () => {
  test('emits and deduplicates a deterministic price-below event', async () => {
    const engine = new TriggerEngine([definition({ type: 'price_below', field: 'price', threshold: 20 })], store());
    const observation = { observedAt, sourceKey: 'offer:drill', values: { price: 19.5 } };
    const first = await engine.evaluate('trigger:1', observation);
    const replay = await engine.evaluate('trigger:1', observation);
    expect(first).not.toBeNull();
    expect(replay).toEqual(first);
  });

  test('does not fire when the condition is false or disabled', async () => {
    const inactive = new TriggerEngine([definition({ type: 'availability_detected', field: 'available' }, { enabled: false })], store());
    expect(await inactive.evaluate('trigger:1', { observedAt, sourceKey: 'item:1', values: { available: true } })).toBeNull();
    const active = new TriggerEngine([definition({ type: 'price_below', field: 'price', threshold: 20 })], store());
    expect(await active.evaluate('trigger:1', { observedAt, sourceKey: 'item:1', values: { price: 21 } })).toBeNull();
  });

  test('supports content, deadline, new-match and availability conditions', async () => {
    const cases: Array<[TriggerDefinition['condition'], unknown]> = [
      [{ type: 'content_changed', field: 'hash', baselineHash: 'old' }, 'new'],
      [{ type: 'deadline_near', field: 'deadline', withinMinutes: 60 }, '2026-08-08T15:30:00.000Z'],
      [{ type: 'new_match', field: 'matches' }, ['match:1']],
      [{ type: 'availability_detected', field: 'slots' }, 2],
    ];
    for (const [condition, value] of cases) {
      const engine = new TriggerEngine([definition(condition)], store());
      await expect(engine.evaluate('trigger:1', { observedAt, sourceKey: 'source:1', values: { [condition.field]: value } })).resolves.not.toBeNull();
    }
  });

  test('rejects duplicate or malformed trigger definitions', () => {
    const valid = definition({ type: 'new_match', field: 'matches' });
    expect(() => new TriggerEngine([valid, valid], store())).toThrow(TriggerDefinitionError);
    expect(() => new TriggerEngine([definition({ type: 'deadline_near', field: 'deadline', withinMinutes: 0 })], store())).toThrow(TriggerDefinitionError);
  });

  test('defensively copies definitions', () => {
    const original = definition({ type: 'price_below', field: 'price', threshold: 20 });
    const engine = new TriggerEngine([original], store());
    const listed = engine.list()[0] as TriggerDefinition & { condition: { threshold?: number } };
    if ('threshold' in listed.condition) listed.condition.threshold = 1;
    expect((engine.list()[0].condition as { threshold: number }).threshold).toBe(20);
  });
});
