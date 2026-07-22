import { InboxError } from './page-context-inbox.mjs';

const SIGNALS = new Set(['useful', 'saved', 'dismissed', 'not_interested']);
const DELTAS = { useful: 6, saved: 10, dismissed: -5, not_interested: -10 };
const MAX_EVENTS = 500;

export class PreferenceLearner {
  constructor(store) { this.store = store; }

  async record(opportunityId, input) {
    if (typeof opportunityId !== 'string' || !opportunityId.startsWith('opportunity:')) throw invalid('Opportunity id is invalid');
    if (!input || typeof input !== 'object' || Array.isArray(input) || !SIGNALS.has(input.signal)) throw invalid('Feedback signal is invalid');
    return this.store.project(async (data) => {
      const opportunity = (data.opportunities ?? []).find((item) => item.id === opportunityId);
      if (!opportunity) throw new InboxError('OPPORTUNITY_NOT_FOUND', 'Opportunity was not found', 404);
      const feedback = Array.isArray(data.preferenceFeedback) ? data.preferenceFeedback : [];
      const id = `${opportunityId}:${input.signal}`;
      const previous = feedback.find((item) => item.id === id);
      const opportunities = input.signal === 'dismissed'
        ? (data.opportunities ?? []).map((item) => item.id === opportunityId ? { ...item, status: 'dismissed' } : item)
        : data.opportunities;
      const statusChanged = input.signal === 'dismissed' && opportunity.status !== 'dismissed';
      if (previous) return { changed: statusChanged, data: statusChanged ? { ...data, opportunities } : data, result: previous };
      const event = {
        id, opportunityId, signal: input.signal,
        category: opportunity.category, benefitType: opportunity.benefitType,
        sourceHost: opportunity.sourceHost, recordedAt: new Date().toISOString(),
      };
      return {
        changed: true,
        data: { ...data, opportunities, preferenceFeedback: [...feedback.slice(-(MAX_EVENTS - 1)), event] },
        result: event,
      };
    });
  }

  async profile() {
    return buildPreferenceProfile((await this.store.read()).preferenceFeedback ?? []);
  }

  async reset() {
    return this.store.project(async (data) => ({
      changed: Boolean(data.preferenceFeedback?.length),
      data: { ...data, preferenceFeedback: [] },
      result: { reset: true },
    }));
  }
}

export function buildPreferenceProfile(events) {
  const profile = { categories: {}, benefitTypes: {}, sources: {}, eventCount: 0 };
  for (const event of events ?? []) {
    const delta = DELTAS[event?.signal];
    if (!delta) continue;
    profile.eventCount += 1;
    add(profile.categories, event.category, delta, 20);
    add(profile.benefitTypes, event.benefitType, Math.sign(delta) * Math.min(4, Math.abs(delta)), 12);
    add(profile.sources, event.sourceHost, Math.sign(delta) * 2, 6);
  }
  return profile;
}

export function preferenceAdjustment(opportunity, profile) {
  return clamp(
    Number(profile?.categories?.[opportunity.category] ?? 0)
      + Number(profile?.benefitTypes?.[opportunity.benefitType] ?? 0)
      + Number(profile?.sources?.[opportunity.sourceHost] ?? 0),
    -25, 25,
  );
}

function add(target, key, delta, limit) {
  if (typeof key !== 'string' || !key) return;
  target[key] = clamp(Number(target[key] ?? 0) + delta, -limit, limit);
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function invalid(message) { return new InboxError('INVALID_PREFERENCE_FEEDBACK', message, 400); }
