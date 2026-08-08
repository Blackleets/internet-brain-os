import { createHash } from 'node:crypto';
import type { TriggerDefinition, TriggerEvent, TriggerObservation } from './trigger-contract';

export interface TriggerEventStore {
  transaction<T>(callback: (events: readonly TriggerEvent[]) => Promise<T>): Promise<T>;
  write(events: readonly TriggerEvent[]): Promise<void>;
}

export class TriggerDefinitionError extends Error {
  readonly code = 'INVALID_TRIGGER_DEFINITION';
  constructor(message: string) { super(message); this.name = 'TriggerDefinitionError'; }
}

export class TriggerEngine {
  private readonly triggers: ReadonlyMap<string, TriggerDefinition>;

  constructor(definitions: readonly TriggerDefinition[], private readonly store: TriggerEventStore) {
    const map = new Map<string, TriggerDefinition>();
    for (const definition of definitions) {
      validateDefinition(definition);
      if (map.has(definition.id)) throw new TriggerDefinitionError(`Duplicate trigger id: ${definition.id}`);
      map.set(definition.id, cloneDefinition(definition));
    }
    this.triggers = map;
  }

  list(): readonly TriggerDefinition[] {
    return [...this.triggers.values()].map(cloneDefinition);
  }

  async evaluate(triggerId: string, observation: TriggerObservation): Promise<TriggerEvent | null> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || !trigger.enabled) return null;
    const reason = matchReason(trigger, observation);
    if (!reason) return null;

    const eventKey = hash(stableStringify({
      triggerId: trigger.id,
      revisionId: trigger.revisionId,
      sourceKey: observation.sourceKey,
      observedAt: observation.observedAt,
      conditionValue: observation.values[trigger.condition.field],
    }));
    const event: TriggerEvent = {
      id: `trigger-event:${eventKey.slice(0, 24)}`,
      triggerId: trigger.id,
      goalId: trigger.goalId,
      planId: trigger.planId,
      revisionId: trigger.revisionId,
      sourceKey: clean(observation.sourceKey, 'sourceKey'),
      observedAt: requireIso(observation.observedAt, 'observedAt'),
      eventKey,
      reason,
    };

    return this.store.transaction(async (events) => {
      const existing = events.find((candidate) => candidate.eventKey === eventKey);
      if (existing) return { ...existing };
      await this.store.write([...events.map((candidate) => ({ ...candidate })), { ...event }]);
      return { ...event };
    });
  }
}

function matchReason(trigger: TriggerDefinition, observation: TriggerObservation): string | null {
  requireIso(observation.observedAt, 'observedAt');
  clean(observation.sourceKey, 'sourceKey');
  const value = observation.values[trigger.condition.field];
  switch (trigger.condition.type) {
    case 'price_below':
      return typeof value === 'number' && Number.isFinite(value) && value < trigger.condition.threshold
        ? `${trigger.condition.field} below ${trigger.condition.threshold}` : null;
    case 'new_match':
      return hasMatch(value) ? `${trigger.condition.field} contains a new match` : null;
    case 'content_changed':
      return typeof value === 'string' && value.length > 0 && value !== trigger.condition.baselineHash
        ? `${trigger.condition.field} changed` : null;
    case 'deadline_near': {
      if (typeof value !== 'string') return null;
      const deadline = Date.parse(value);
      const observed = Date.parse(observation.observedAt);
      if (!Number.isFinite(deadline) || deadline < observed) return null;
      const remaining = deadline - observed;
      return remaining <= trigger.condition.withinMinutes * 60_000
        ? `${trigger.condition.field} deadline is near` : null;
    }
    case 'availability_detected':
      return value === true || (typeof value === 'number' && value > 0)
        ? `${trigger.condition.field} availability detected` : null;
  }
}

function validateDefinition(definition: TriggerDefinition): void {
  clean(definition.id, 'id'); clean(definition.goalId, 'goalId'); clean(definition.planId, 'planId');
  clean(definition.revisionId, 'revisionId'); requireIso(definition.createdAt, 'createdAt');
  clean(definition.condition.field, 'condition.field');
  if (definition.condition.type === 'price_below' && !Number.isFinite(definition.condition.threshold)) {
    throw new TriggerDefinitionError('price_below threshold must be finite');
  }
  if (definition.condition.type === 'deadline_near' && (!Number.isInteger(definition.condition.withinMinutes) || definition.condition.withinMinutes <= 0)) {
    throw new TriggerDefinitionError('deadline_near withinMinutes must be a positive integer');
  }
  if (definition.condition.type === 'content_changed') clean(definition.condition.baselineHash, 'baselineHash');
}

function cloneDefinition(definition: TriggerDefinition): TriggerDefinition {
  return { ...definition, condition: { ...definition.condition } } as TriggerDefinition;
}

function hasMatch(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

function clean(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TriggerDefinitionError(`${field} is required`);
  return value.trim();
}

function requireIso(value: string, field: string): string {
  const cleaned = clean(value, field);
  if (!Number.isFinite(Date.parse(cleaned))) throw new TriggerDefinitionError(`${field} must be an ISO datetime`);
  return cleaned;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
