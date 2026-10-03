import { foldText, researchQueryPlan, type ResearchQueryPlan } from "./search-parse.ts";

const STRUCTURE_HINT =
  /\b(precio|precios|price|prices|coste|costo|tasa|rate|histor|serie|inflacion|inflación|pib|gdp|cotiz|valor|values|metric|dato|datos|data|volumen|volume|indice|índice|index)\b/u;

function uniqueQueries(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export type ResearchPlan = ResearchQueryPlan & {
  original: string;
  webQuery: string;
  entityQuery: string;
  compactQuery: string;
  queries: string[];
  wantsStructured: boolean;
};

export function planResearch(query: string): ResearchPlan {
  const original = query.trim();
  const base = researchQueryPlan(original);
  const folded = foldText(original);
  const focused = base.tokens;
  const years = focused.filter((token) => /^(19|20)\d{2}$/.test(token));
  const withoutYears = focused.filter((token) => !/^(19|20)\d{2}$/.test(token) && !/^\d+$/.test(token));
  const tickers = withoutYears.filter((token) => token.length <= 5);
  const webQuery = focused.join(" ") || base.core || original;
  const entityQuery = (tickers.length ? tickers : withoutYears).slice(0, 3).join(" ") || webQuery;
  const compactQuery = withoutYears.slice(0, 4).join(" ") || webQuery;
  return {
    ...base,
    original,
    tokens: focused,
    core: webQuery,
    webQuery,
    entityQuery,
    compactQuery,
    queries: uniqueQueries([webQuery, compactQuery, entityQuery]),
    wantsStructured: years.length > 0 || STRUCTURE_HINT.test(folded),
  };
}

export function urlsMentioned(query: string): string[] {
  const matches = query.match(/https:\/\/[^\s<>"'`]+/gi) ?? [];
  return matches.map((item) => item.replace(/[),.;]+$/, ""));
}
