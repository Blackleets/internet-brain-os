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
  const haystack = fold([page.title, page.excerpt, page.text].filter(Boolean).join(' '));
  if (!haystack) {
    return { supported: false, reason: 'no_evidence' };
  }

  const goalTokens = tokenize([goal.title, ...(goal.keywords ?? [])].filter(Boolean).join(' '));
  if (!goalTokens.length) {
    return { supported: false, reason: 'empty_goal' };
  }

  const uniqueIds = goalTokens.filter(isUniqueGoalId);
  if (uniqueIds.some((id) => !haystack.includes(id))) {
    return { supported: false, reason: 'unique_id_missing' };
  }

  const goalTerms = uniqueMeaningfulTerms(goalTokens.filter((token) => !isUniqueGoalId(token)));
  if (!goalTerms.length) {
    return uniqueIds.length
      ? { supported: true, reason: 'supported' }
      : { supported: false, reason: 'empty_goal' };
  }

  const pageTokens = new Set(tokenize(haystack));
  const hits = goalTerms.filter((term) => termCovered(term, pageTokens, haystack)).length;
  const homepage = isHomepage(page.url);
  const minHits = homepage ? 3 : 2;
  const ratio = homepage ? 0.6 : 0.4;
  const required = Math.max(minHits, Math.ceil(ratio * goalTerms.length));
  if (hits < required) {
    return {
      supported: false,
      reason: homepage ? 'homepage_insufficient_coverage' : 'insufficient_term_coverage',
    };
  }
  return { supported: true, reason: 'supported' };
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

function termCovered(canonical: string, pageTokens: Set<string>, haystack: string): boolean {
  const group = SYNONYM_LOOKUP.get(canonical) ?? [canonical];
  return group.some((synonym) => pageTokens.has(synonym) || haystack.includes(synonym));
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
