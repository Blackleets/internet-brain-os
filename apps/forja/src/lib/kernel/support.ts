import type { Evidence, Finding } from "./types.ts";

/** HTTP 200 + hash proves retrieval. It does not prove the Goal. */
export const KERNEL_SUPPORT_CONTRACT = Object.freeze({
  retrievedIsNotCompletion: true,
  httpOkIsNotSupport: true,
  keywordIsNotSupport: true,
  modelCannotComplete: true,
  agentCannotComplete: true,
  supportRequiredToSeal: true,
  supportRequiredToComplete: true,
});

export const INCOMPLETE_SUPPORT_REASON =
  "Investigación incompleta. Se recuperaron páginas, pero ninguna demuestra el Goal. El Kernel no sella.";

const STOP = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "y",
  "o",
  "u",
  "que",
  "se",
  "en",
  "es",
  "su",
  "sus",
  "por",
  "para",
  "con",
  "sin",
  "como",
  "mas",
  "más",
  "pero",
  "si",
  "sí",
  "no",
  "ya",
  "lo",
  "le",
  "les",
  "me",
  "te",
  "esta",
  "este",
  "esto",
  "estas",
  "estos",
  "esa",
  "ese",
  "eso",
  "the",
  "a",
  "an",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "for",
  "from",
  "on",
  "at",
  "by",
  "with",
  "as",
  "or",
  "and",
  "not",
  "this",
  "that",
  "it",
  "its",
  "into",
  "about",
  "over",
  "http",
  "https",
  "www",
  "com",
  "org",
  "html",
  "sigue",
  "usando",
  "debe",
  "existir",
  "existe",
  "sobre",
  "entre",
  "menos",
  "despues",
  "después",
  "antes",
  "hacia",
  "hasta",
  "desde",
  "cuando",
  "donde",
  "qué",
  "cual",
  "cuál",
  "otro",
  "otra",
  "otros",
  "otras",
]);

/** Weak words may appear in a Goal without being the thing to demonstrate. */
const WEAK = new Set([
  "clave",
  "unico",
  "única",
  "unica",
  "unicos",
  "únicos",
  "token",
  "tokens",
  "web",
  "pagina",
  "página",
  "paginas",
  "páginas",
  "sitio",
  "investiga",
  "buscar",
  "busca",
  "comparar",
  "compara",
  "fuentes",
  "fuente",
  "empresa",
  "empresas",
  "company",
  "companies",
  "compania",
  "compañia",
  "compañía",
  "publica",
  "pública",
  "publicas",
  "públicas",
  "publico",
  "público",
  "realmente",
  "todavia",
  "todavía",
  "ainda",
  "still",
  "using",
  "does",
  "page",
  "pages",
  "site",
  "unique",
  "must",
  "exist",
  "index",
]);

const PREDICATE_GROUPS: string[][] = [
  ["bolsa", "cotizada", "cotizado", "cotizar", "ipo", "listed", "listing", "bursatil", "bursátil", "ticker", "nasdaq", "nyse"],
  ["bitcoin", "btc"],
  ["curso", "legal", "moneda", "tender", "divisa"],
  ["euro", "euros", "eur"],
  ["taladro", "drill"],
  ["salvador", "salvadoreño", "salvadoreno"],
  ["openai"],
];

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function tokenize(value: string): string[] {
  const folded = fold(value);
  const raw = folded.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const out: string[] = [];
  for (const token of raw) {
    const trimmed = token.replace(/^-+|-+$/g, "");
    if (!trimmed) continue;
    out.push(trimmed);
    if (trimmed.includes("-")) {
      for (const part of trimmed.split("-")) {
        if (part) out.push(part);
      }
    }
  }
  return out;
}

function isMostlyNumeric(token: string) {
  return /^[\d.-]+$/.test(token);
}

export function isUniqueIdentifier(token: string) {
  if (token.length >= 16) return true;
  const parts = token.split("-").filter(Boolean);
  if (parts.length >= 3 && token.length >= 12) return true;
  if (token.length >= 10 && /[a-z]/i.test(token) && /\d/.test(token)) return true;
  return false;
}

function synonyms(token: string): string[] {
  const folded = fold(token);
  const group = PREDICATE_GROUPS.find((row) => row.includes(folded));
  return group ? [...group] : [folded];
}

export function parseGoalSupport(text: string) {
  const tokens = tokenize(text);
  const uniqueIds = [...new Set(tokens.filter((token) => isUniqueIdentifier(token)))];
  const terms = [
    ...new Set(
      tokens.filter(
        (token) =>
          token.length >= 4 &&
          !STOP.has(token) &&
          !WEAK.has(token) &&
          !isMostlyNumeric(token) &&
          !isUniqueIdentifier(token),
      ),
    ),
  ];
  const names = namedEntities(text);
  return { uniqueIds, terms, names };
}

/** Capitalized or inner-capped tokens in the Goal (OpenAI, Salvador). Not a keyword spray. */
function namedEntities(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.split(/[^\p{L}\p{N}-]+/u).filter(Boolean)) {
    if (raw.length < 4) continue;
    const folded = fold(raw);
    if (STOP.has(folded) || WEAK.has(folded) || isMostlyNumeric(folded) || isUniqueIdentifier(folded)) continue;
    if (/^\p{Lu}/u.test(raw) || /[a-z][A-Z]/.test(raw)) names.push(folded);
  }
  return [...new Set(names)];
}

function groupKey(token: string) {
  const folded = fold(token);
  const group = PREDICATE_GROUPS.find((row) => row.includes(folded));
  return group ? group[0] : folded;
}

function termHitCount(terms: string[], blob: string, blobTokens: Set<string>) {
  const seen = new Set<string>();
  for (const term of terms) {
    if (!blobHas(blob, blobTokens, term)) continue;
    seen.add(groupKey(term));
  }
  return seen.size;
}

export function isBareHomepage(url: string) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return false;
  }
}

function blobHas(blob: string, blobTokens: Set<string>, token: string) {
  if (blobTokens.has(token)) return true;
  if (isUniqueIdentifier(token) && blob.includes(token)) return true;
  return synonyms(token).some((item) => blobTokens.has(item) || (item.length >= 4 && blob.includes(item)));
}

export function evidenceSupportsGoal(
  goalText: string,
  evidence: Pick<Evidence, "title" | "excerpt" | "url">,
): boolean {
  const goal = parseGoalSupport(goalText);
  const blob = fold(`${evidence.title ?? ""} ${evidence.excerpt ?? ""}`);
  const blobTokens = new Set(tokenize(blob));

  if (goal.uniqueIds.length) {
    const covered = goal.uniqueIds.some((id) => blob.includes(id) || blobTokens.has(id));
    if (!covered) return false;
    if (!goal.terms.length) return true;
    return goal.terms.some((term) => blobHas(blob, blobTokens, term));
  }

  if (goal.names.length) {
    const named = goal.names.some((name) => blobHas(blob, blobTokens, name));
    if (!named) return false;
  }

  const termHits = termHitCount(goal.terms, blob, blobTokens);
  const groups = new Set(goal.terms.map(groupKey)).size || goal.terms.length;
  if (!goal.uniqueIds.length && !goal.names.length && groups < 2) {
    return false;
  }
  if (isBareHomepage(evidence.url)) {
    return termHits >= Math.max(3, Math.ceil(groups * 0.6));
  }
  if (groups < 2) return termHits >= 1;
  const need = Math.max(2, Math.ceil(groups * 0.4));
  return termHits >= Math.min(need, groups);
}

export type GoalSupport = {
  ok: boolean;
  supportedEvidence: Evidence[];
  supportedFindings: Finding[];
  reason: string;
};

export function goalSupport(input: {
  goalText: string;
  evidence: Evidence[];
  findings?: Finding[];
}): GoalSupport {
  const retrieved = input.evidence.filter((item) => item.validation === "retrieved");
  const supportedEvidence = retrieved.filter((item) => evidenceSupportsGoal(input.goalText, item));
  const supportedIds = new Set(supportedEvidence.map((item) => item.id));
  const supportedFindings = (input.findings ?? []).filter((item) =>
    item.evidenceIds.some((id) => supportedIds.has(id)),
  );
  if (!supportedEvidence.length) {
    return {
      ok: false,
      supportedEvidence,
      supportedFindings,
      reason: INCOMPLETE_SUPPORT_REASON,
    };
  }
  if ((input.findings?.length ?? 0) > 0 && !supportedFindings.length) {
    return {
      ok: false,
      supportedEvidence,
      supportedFindings,
      reason: INCOMPLETE_SUPPORT_REASON,
    };
  }
  return {
    ok: true,
    supportedEvidence,
    supportedFindings,
    reason: "",
  };
}

export function maySealGoal(support: GoalSupport) {
  return (
    support.ok &&
    support.supportedEvidence.length > 0 &&
    support.supportedFindings.some((item) => item.interpretationAvailable)
  );
}
