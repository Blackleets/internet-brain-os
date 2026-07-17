import type { Entity, EntityId } from '@internet-brain-os/shared';

export type EntityResolutionDecision = 'match' | 'candidate' | 'no_match';

export interface EntityResolutionCandidate {
  readonly entityId: EntityId;
  readonly score: number;
  readonly decision: EntityResolutionDecision;
  readonly reasons: readonly string[];
}

export interface EntityResolutionInput {
  readonly name: string;
  readonly type?: string;
  readonly aliases?: readonly string[];
}

export interface EntityResolutionOptions {
  readonly matchThreshold?: number;
  readonly candidateThreshold?: number;
}

/**
 * Deterministic, conservative entity resolution.
 * It never merges entities; it only ranks existing canonical entities.
 */
export class EntityResolutionEngine {
  resolve(
    input: EntityResolutionInput,
    entities: readonly Entity[],
    options: EntityResolutionOptions = {},
  ): readonly EntityResolutionCandidate[] {
    const matchThreshold = options.matchThreshold ?? 0.92;
    const candidateThreshold = options.candidateThreshold ?? 0.65;
    const queryName = normalize(input.name);
    const queryAliases = new Set((input.aliases ?? []).map(normalize).filter(Boolean));

    return entities
      .map((entity) => scoreEntity(queryName, queryAliases, input.type, entity, matchThreshold, candidateThreshold))
      .filter((candidate) => candidate.score >= candidateThreshold)
      .sort((a, b) => b.score - a.score);
  }
}

function scoreEntity(
  queryName: string,
  queryAliases: ReadonlySet<string>,
  queryType: string | undefined,
  entity: Entity,
  matchThreshold: number,
  candidateThreshold: number,
): EntityResolutionCandidate {
  const names = [entity.name, ...(entity.aliases ?? [])].map(normalize).filter(Boolean);
  const exact = names.some((name) => name === queryName || queryAliases.has(name));
  const aliasExact = names.some((name) => queryAliases.has(name));
  const typeMatch = !queryType || entity.type.toLowerCase() === queryType.trim().toLowerCase();
  const tokenScore = tokenSimilarity(queryName, names);

  let score = tokenScore;
  const reasons: string[] = [];
  if (exact) { score = Math.max(score, 1); reasons.push('exact_name_or_alias'); }
  if (aliasExact) { score = Math.max(score, 0.98); reasons.push('alias_match'); }
  if (typeMatch && queryType) { score = Math.min(1, score + 0.05); reasons.push('type_match'); }
  if (!typeMatch) { score *= 0.5; reasons.push('type_mismatch'); }

  const decision: EntityResolutionDecision = score >= matchThreshold
    ? 'match'
    : score >= candidateThreshold
      ? 'candidate'
      : 'no_match';

  return { entityId: entity.id, score: round(score), decision, reasons };
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function tokenSimilarity(query: string, names: readonly string[]): number {
  if (!query) return 0;
  const queryTokens = new Set(query.split(' '));
  return Math.max(...names.map((name) => {
    const tokens = new Set(name.split(' '));
    const intersection = [...queryTokens].filter((token) => tokens.has(token)).length;
    const union = new Set([...queryTokens, ...tokens]).size;
    return union ? intersection / union : 0;
  }), 0);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
