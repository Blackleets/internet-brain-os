export interface GoalSupportInput {
  readonly title?: string;
  readonly keywords?: readonly string[];
}

export interface PageSupportInput {
  readonly title?: string;
  readonly excerpt?: string;
  readonly url?: string;
  readonly text?: string;
}

export interface EvidenceSupportResult {
  readonly supported: boolean;
  readonly reason: string;
}

/** Read-only explanation of a SUPPORT decision (which Goal terms the page covered). */
export interface EvidenceSupportExplanation extends EvidenceSupportResult {
  /** Meaningful Goal terms (title + keywords), canonical, including generic filler. */
  readonly goalTerms: readonly string[];
  /** Subject terms that can count as coverage (generic filler such as "explained" excluded). */
  readonly subjectTerms: readonly string[];
  /** Subject terms the fetched page covers. */
  readonly matchedTerms: readonly string[];
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'if', 'in', 'into', 'is',
  'it', 'its', 'just', 'may', 'might', 'more', 'most', 'no', 'not', 'of', 'on', 'or', 'over',
  'should', 'so', 'some', 'than', 'that', 'the', 'then', 'this', 'to', 'too', 'very', 'was',
  'were', 'what', 'when', 'where', 'which', 'who', 'will', 'with', 'would',
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'u',
  'en', 'para', 'por', 'con', 'que', 'es', 'se', 'su', 'sus', 'lo', 'le', 'les', 'esta',
  'este', 'esto', 'estas', 'estos', 'hay', 'ser', 'son', 'como', 'sobre', 'sin', 'mas',
  'find', 'finding', 'finds', 'busca', 'buscar', 'busco', 'looking', 'search', 'searches',
  'investiga', 'investigar', 'investigation', 'goal', 'objetivo', 'objetivos', 'quiero',
  'necesito', 'need', 'needed', 'please', 'me', 'mi', 'mis', 'my', 'your', 'our',
  'locate', 'record', 'public', 'filings', 'about', 'after', 'before', 'during', 'without',
  'within', 'using', 'use', 'used', 'via', 'get', 'got', 'make', 'made', 'new',
]);

/**
 * Generic filler that describes the *form* of the wanted content, not its subject.
 * These stay in the Goal term count (so the coverage requirement never drops) but can
 * never count as a coverage hit: "Rust lifetimes explained" must not be supported by a
 * Python page because it happens to contain "lifetimes" and "explained".
 */
const GENERIC_TERMS = new Set([
  'explain', 'explained', 'explaining', 'explains', 'explanation', 'explainer',
  'guide', 'guides', 'tutorial', 'tutorials', 'introduction', 'intro', 'overview',
  'basics', 'beginner', 'beginners', 'learn', 'learning', 'understand', 'understanding',
  'example', 'examples', 'best', 'top', 'tips', 'complete', 'ultimate', 'simple', 'easy',
  'quick', 'why', 'deep', 'dive',
]);

const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['bolsa', 'cotizada', 'ipo', 'listed'],
  ['bitcoin', 'btc'],
  ['curso', 'legal', 'moneda'],
  ['euro', 'eur'],
  ['taladro', 'drill'],
];

const SYNONYM_LOOKUP = new Map<string, readonly string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const member of group) SYNONYM_LOOKUP.set(member, group);
}

export function evidenceSupportsGoal(
  goal: GoalSupportInput,
  page: PageSupportInput,
): EvidenceSupportResult {
  const { supported, reason } = explainEvidenceSupport(goal, page);
  return { supported, reason };
}

export function explainEvidenceSupport(
  goal: GoalSupportInput,
  page: PageSupportInput,
): EvidenceSupportExplanation {
  const none = { goalTerms: [], subjectTerms: [], matchedTerms: [] };
  const haystack = fold([page.title, page.excerpt, page.text].filter(Boolean).join(' '));
  if (!haystack) {
    return { supported: false, reason: 'no_evidence', ...none };
  }

  const goalTokens = tokenize([goal.title, ...(goal.keywords ?? [])].filter(Boolean).join(' '));
  if (!goalTokens.length) {
    return { supported: false, reason: 'empty_goal', ...none };
  }

  const uniqueIds = goalTokens.filter(isUniqueGoalId);
  if (uniqueIds.some((id) => !haystack.includes(id))) {
    return { supported: false, reason: 'unique_id_missing', ...none };
  }

  const goalTerms = uniqueMeaningfulTerms(goalTokens.filter((token) => !isUniqueGoalId(token)));
  if (!goalTerms.length) {
    return uniqueIds.length
      ? { supported: true, reason: 'supported', ...none }
      : { supported: false, reason: 'empty_goal', ...none };
  }

  const subjectTerms = goalTerms.filter((term) => !GENERIC_TERMS.has(term));
  const pageTokens = pageTokenSet(haystack);
  const matchedTerms = subjectTerms.filter((term) => termCovered(term, pageTokens));
  const explanation = { goalTerms, subjectTerms, matchedTerms };
  const homepage = isHomepage(page.url);
  const minHits = homepage ? 3 : 2;
  const ratio = homepage ? 0.6 : 0.4;
  // Requirement is computed from every Goal term (filler included) so excluding filler
  // from hits can only tighten SUPPORT, never loosen it.
  const required = Math.max(minHits, Math.ceil(ratio * goalTerms.length));
  if (matchedTerms.length < required) {
    return {
      supported: false,
      reason: homepage ? 'homepage_insufficient_coverage' : 'insufficient_term_coverage',
      ...explanation,
    };
  }

  // Explicit Mission keywords are the owner's subject: the page must cover them too
  // (all of them when one or two are given, at least two otherwise).
  const keywordTerms = uniqueMeaningfulTerms(
    tokenize((goal.keywords ?? []).filter(Boolean).join(' ')).filter((token) => !isUniqueGoalId(token)),
  ).filter((term) => !GENERIC_TERMS.has(term));
  if (keywordTerms.length) {
    const keywordHits = keywordTerms.filter((term) => termCovered(term, pageTokens)).length;
    if (keywordHits < Math.min(2, keywordTerms.length)) {
      return { supported: false, reason: 'mission_keywords_missing', ...explanation };
    }
  }
  return { supported: true, reason: 'supported', ...explanation };
}

function uniqueMeaningfulTerms(tokens: readonly string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const token of tokens) {
    if (token.length < 2 || STOPWORDS.has(token)) continue;
    const canonical = SYNONYM_LOOKUP.get(token)?.[0] ?? token;
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    terms.push(canonical);
  }
  return terms;
}

/**
 * Whole-token coverage (or a token that starts with the term, for plurals/inflections).
 * Raw substring matching let "rust" match "trust"/"frustrating".
 */
function termCovered(canonical: string, pageTokens: ReadonlySet<string>): boolean {
  const group = SYNONYM_LOOKUP.get(canonical) ?? [canonical];
  return group.some((synonym) => {
    if (pageTokens.has(synonym)) return true;
    for (const token of pageTokens) if (token.startsWith(synonym)) return true;
    return false;
  });
}

function pageTokenSet(haystack: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of tokenize(haystack)) {
    tokens.add(token);
    if (token.includes('-')) for (const part of token.split('-')) if (part) tokens.add(part);
  }
  return tokens;
}

function isUniqueGoalId(token: string): boolean {
  if (token.length >= 16) return true;
  if (token.length >= 12 && token.includes('-')) return true;
  if (token.length >= 10 && /[a-z]/.test(token) && /\d/.test(token)) return true;
  return false;
}

function isHomepage(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.pathname.replace(/\/+$/, '') === '';
  } catch {
    return false;
  }
}

function tokenize(value: string): string[] {
  return fold(value).match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) ?? [];
}

function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim();
}
