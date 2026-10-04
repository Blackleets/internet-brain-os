import { createHash } from 'node:crypto';
import { InboxError } from './page-context-inbox.mjs';
import { enrichGoalIntent, GOAL_CATEGORIES } from './goal-intent-enrichment.mjs';
import { createGoalExecutionAuthorizationReceipt, currentGoalRevision } from './goal-execution-authorization.mjs';
import { isMissionActive } from './agent-missions.mjs';

const ALLOWED_CATEGORIES = new Set(GOAL_CATEGORIES);
const MAX_REVISION_HISTORY = 20;

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

  /**
   * Goal revision ("Editar Goal"): an interactive user decision that changes a confirmed Goal's
   * title / keywords / location while it keeps its id, so its Missions, their earlier attempts,
   * Evidence and Finds stay attached. After a revision the id is a historical identity (the hash
   * of the content the Goal was created with), not a hash of its current content.
   *
   * - Only the dashboard / extension interactive confirmation may revise (403 otherwise).
   * - The revision number increases by one (legacy Goals start at 1), so Mission authorization
   *   receipts issued for the earlier revision no longer match (automatic continuation denies
   *   `authorization_revision_mismatch`) until the user confirms again ("Buscar más").
   * - A Mission with a live Hermes lease blocks the revision (409); a queued / waiting Mission is
   *   re-scoped to the new text and re-authorized by the same interactive confirmation.
   * - Finished Missions, their priorAttempts, Evidence and Finds are never touched.
   */
  async revise(goalId, input, context = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Goal revision must be an object');
    if (input.confirmed !== true) throw invalid('Goal revision requires explicit confirmation');
    const confirmationActor = context?.confirmationActor;
    if (!confirmationActor) throw new InboxError('GOAL_REVISION_CONFIRMATION_REQUIRED', 'Editing a Goal needs an interactive confirmation', 403);
    const expectedRevision = input.expectedRevision === undefined ? undefined : Number(input.expectedRevision);
    if (expectedRevision !== undefined && (!Number.isInteger(expectedRevision) || expectedRevision < 1)) throw invalid('Goal expected revision is invalid');
    const now = (context.now ?? (() => new Date()))();

    return this.store.project(async (data) => {
      const goals = Array.isArray(data.goals) ? data.goals : [];
      const index = goals.findIndex((item) => item.id === goalId);
      const existing = index >= 0 ? goals[index] : undefined;
      if (!existing || existing.status !== 'active') throw new InboxError('GOAL_NOT_FOUND', 'Active Goal was not found', 404);
      // Universal Goals (contract v2) carry their own revision contract; this path edits legacy Goals.
      if (existing.contractVersion !== undefined) throw new InboxError('GOAL_REVISION_UNSUPPORTED', 'This Goal format has its own revision path', 409);
      const revision = currentGoalRevision(existing);
      if (expectedRevision !== undefined && expectedRevision !== revision) {
        throw new InboxError('GOAL_REVISION_CONFLICT', `Goal is at revision ${revision}, not ${expectedRevision}`, 409);
      }
      // Omitted keywords / categories are kept while the title stays the same, and re-derived from a
      // new title (so words the user removed from the title do not linger as search keywords).
      const title = input.title ?? existing.title;
      const sameTitle = normalize(clean(title, 120)) === normalize(existing.title);
      const content = validateGoalContent({
        title,
        ...(input.categories !== undefined ? { categories: input.categories } : sameTitle ? { categories: existing.categories ?? [] } : {}),
        ...(input.keywords !== undefined ? { keywords: input.keywords } : sameTitle ? { keywords: existing.keywords ?? [] } : {}),
        location: input.location === null ? '' : (input.location ?? existing.location),
      });
      const previous = goalContent(existing);
      const changedFields = Object.keys(content).filter((key) => JSON.stringify(content[key] ?? null) !== JSON.stringify(previous[key] ?? null));
      if (!changedFields.length) return { changed: false, data, result: { goal: existing, changed: false, revision } };

      const missions = Array.isArray(data.agentMissions) ? data.agentMissions : [];
      const goalMissions = missions.filter((mission) => mission.goalId === goalId);
      if (goalMissions.some((mission) => mission.status === 'running' && isMissionActive(mission, now))) {
        throw new InboxError('GOAL_MISSION_RUNNING', 'Hermes is working on this Goal; edit it when the attempt finishes', 409);
      }
      const decidedAt = now.toISOString();
      const revised = {
        ...existing,
        ...content,
        location: content.location,
        revision: revision + 1,
        revisedAt: decidedAt,
        revisedBy: confirmationActor.decidedBy,
        idBasis: 'created_content',
        revisions: [...(Array.isArray(existing.revisions) ? existing.revisions : []), {
          revision, ...previous, changedFields, supersededAt: decidedAt, supersededBy: confirmationActor.decidedBy,
        }].slice(-MAX_REVISION_HISTORY),
      };
      if (!revised.location) delete revised.location;
      const updatedGoals = [...goals];
      updatedGoals[index] = revised;
      // Queued / waiting Missions have not started: they follow the new text with a fresh receipt
      // for the new revision, decided by the same interactive confirmation. Finished ones keep the
      // snapshot of what they searched for; "Buscar más" re-scopes them on the next attempt.
      let missionsChanged = false;
      const updatedMissions = missions.map((mission) => {
        if (mission.goalId !== goalId || !isMissionActive(mission, now)) return mission;
        missionsChanged = true;
        return {
          ...mission,
          goalTitle: revised.title,
          scope: { categories: revised.categories, keywords: revised.keywords, location: revised.location },
          ...(mission.authorization ? { authorization: createGoalExecutionAuthorizationReceipt(revised, now, confirmationActor) } : {}),
        };
      });
      return {
        changed: true,
        data: { ...data, goals: updatedGoals, ...(missionsChanged ? { agentMissions: updatedMissions } : {}) },
        result: { goal: revised, changed: true, revision: revised.revision, changedFields },
      };
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
  const { title, categories, keywords, location } = validateGoalContent(input);
  const priority = Number(input.priority ?? 2);
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) throw invalid('Goal priority must be between 1 and 3');
  const createdAt = new Date().toISOString();
  const fingerprint = createHash('sha256').update(JSON.stringify({ title: normalize(title), categories, keywords: keywords.map(normalize), location: normalize(location ?? '') })).digest('hex');
  return { id: `goal:${fingerprint}`, title, categories, keywords, location: location || undefined, priority, status: 'active', createdAt };
}

/** Title / categories / keywords / location, validated and enriched the same way for create and revise. */
function validateGoalContent(input) {
  const title = clean(input.title, 120);
  if (title.length < 3) throw invalid('Goal title must contain at least 3 characters');

  const suppliedCategories = uniqueStrings(input.categories, 13, 32);
  if (suppliedCategories.some((value) => !ALLOWED_CATEGORIES.has(value))) throw invalid('Goal contains an unsupported category');
  const suppliedKeywords = uniqueStrings(input.keywords, 12, 40);
  const intent = enrichGoalIntent({ title, categories: suppliedCategories, keywords: suppliedKeywords, keywordLimit: 12 });
  const categories = intent.categories;
  const keywords = intent.keywords;
  if (!categories.length && !keywords.length) throw invalid('Goal needs at least one category or keyword');

  const location = input.location === undefined ? undefined : clean(input.location, 80);
  return { title, categories, keywords, location: location || undefined };
}

function goalContent(goal) {
  return { title: goal.title, categories: goal.categories ?? [], keywords: goal.keywords ?? [], location: goal.location || undefined };
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
