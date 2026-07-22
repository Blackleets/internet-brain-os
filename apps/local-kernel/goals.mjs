import { createHash } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';

const ALLOWED_CATEGORIES = new Set([
  'job', 'grant', 'client', 'offer', 'tool', 'food', 'aid', 'learning',
  'event', 'housing', 'travel', 'collaboration', 'money',
]);

export class GoalManager {
  constructor(store) { this.store = store; }

  async create(input) {
    const goal = validateGoal(input);
    return this.store.project(async (data) => {
      const goals = Array.isArray(data.goals) ? data.goals : [];
      const existing = goals.find((item) => item.id === goal.id);
      if (existing) return { changed: false, data, result: existing };
      return { changed: true, data: { ...data, goals: [...goals, goal] }, result: goal };
    });
  }

  async list() {
    const data = await this.store.read();
    return (data.goals ?? []).filter((item) => item?.status === 'active')
      .sort((left, right) => right.priority - left.priority || left.createdAt.localeCompare(right.createdAt));
  }
}

export function matchOpportunityToGoals(opportunity, goals) {
  const searchable = normalize(`${opportunity.title ?? ''} ${opportunity.categoryLabel ?? ''} ${opportunity.reasons?.join(' ') ?? ''} ${opportunity.sourceHost ?? ''}`);
  const matches = [];
  for (const goal of goals ?? []) {
    if (goal?.status !== 'active') continue;
    let score = 0;
    const reasons = [];
    if (goal.categories?.includes(opportunity.category)) {
      score += 35;
      reasons.push(`Matches ${opportunity.categoryLabel ?? opportunity.category}`);
    }
    const keywordMatches = (goal.keywords ?? []).filter((keyword) => searchable.includes(normalize(keyword)));
    if (keywordMatches.length) {
      score += Math.min(35, 18 + ((keywordMatches.length - 1) * 8));
      reasons.push(`Keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
    }
    if (goal.location && searchable.includes(normalize(goal.location))) {
      score += 15;
      reasons.push(`Location: ${goal.location}`);
    }
    score += Math.max(0, Math.min(15, (goal.priority - 1) * 5));
    if (score >= 25) matches.push({ goalId: goal.id, title: goal.title, score: Math.min(score, 99), reasons });
  }
  return matches.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
}

function validateGoal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Goal must be an object');
  const title = clean(input.title, 120);
  if (title.length < 3) throw invalid('Goal title must contain at least 3 characters');
  const categories = uniqueStrings(input.categories, 13, 32).filter((value) => ALLOWED_CATEGORIES.has(value));
  const suppliedCategories = Array.isArray(input.categories) ? input.categories.filter((value) => typeof value === 'string') : [];
  if (categories.length !== new Set(suppliedCategories).size) throw invalid('Goal contains an unsupported category');
  const keywords = uniqueStrings(input.keywords, 12, 40);
  if (!categories.length && !keywords.length) throw invalid('Goal needs at least one category or keyword');
  const location = input.location === undefined ? undefined : clean(input.location, 80);
  const priority = Number(input.priority ?? 2);
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) throw invalid('Goal priority must be between 1 and 3');
  const createdAt = new Date().toISOString();
  const fingerprint = createHash('sha256').update(JSON.stringify({ title: normalize(title), categories, keywords: keywords.map(normalize), location: normalize(location ?? '') })).digest('hex');
  return { id: `goal:${fingerprint}`, title, categories, keywords, location: location || undefined, priority, status: 'active', createdAt };
}

function uniqueStrings(value, limit, maxLength) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > limit) throw invalid('Goal list is invalid or too long');
  return [...new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))];
}
function clean(value, maxLength) {
  if (typeof value !== 'string') throw invalid('Goal text must be a string');
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length > maxLength || /[\u0000-\u001f\u007f]/.test(result)) throw invalid('Goal text is invalid or too long');
  return result;
}
function normalize(value) { return String(value).normalize('NFKC').toLocaleLowerCase('en'); }
function invalid(message) { return new InboxError('INVALID_GOAL', message, 400); }
