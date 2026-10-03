import { hostOf } from "../utils.ts";
import { decodeEntities, stripHtml, unwrapDuckLink } from "./extract.ts";
import type {
  DiscoveryReport,
  ProviderProbe,
  SearchHit,
  SearchResult,
  SourceKind,
} from "./io.ts";

const STOPWORDS = new Set([
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
  "en",
  "es",
  "son",
  "fue",
  "era",
  "que",
  "qué",
  "quien",
  "quién",
  "como",
  "cómo",
  "para",
  "por",
  "con",
  "sin",
  "sobre",
  "esta",
  "este",
  "esto",
  "a",
  "e",
  "the",
  "an",
  "of",
  "and",
  "or",
  "in",
  "on",
  "for",
  "to",
  "is",
  "are",
  "was",
  "were",
  "what",
  "who",
  "how",
  "why",
  "which",
  "does",
  "do",
  "did",
  "about",
  "busca",
  "buscar",
  "buscame",
  "investiga",
  "investigar",
  "calcula",
  "calcular",
  "dime",
  "explora",
  "explorar",
  "analiza",
  "analizar",
  "resume",
  "resumir",
  "explica",
  "explicar",
  "encuentra",
  "encontrar",
  "muestra",
  "mostrar",
  "compara",
  "comparar",
  "predice",
  "predecir",
  "estima",
  "estimar",
  "find",
  "search",
  "calculate",
  "compute",
  "tell",
  "show",
  "predict",
  "analyze",
  "analyse",
  "look",
  "investigate",
  "explain",
  "summarize",
  "compare",
  "estimate",
  "si",
  "no",
  "desde",
  "hasta",
  "entre",
  "durante",
  "please",
  "puedes",
  "puede",
  "quiero",
  "necesito",
]);

const WIKI_SKIP_PREFIX =
  /^(Special|Especial|File|Archivo|Help|Ayuda|User|Usuario|Talk|Discusión|Category|Categoría|Template|Plantilla|Wikipedia):/i;

const SEARCH_WRAPPER_HOSTS = new Set([
  "duckduckgo.com",
  "html.duckduckgo.com",
  "lite.duckduckgo.com",
  "r.duckduckgo.com",
  "news.google.com",
]);

export function foldText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export type ResearchQueryPlan = {
  lang: "es" | "en";
  core: string;
  tokens: string[];
};

export function researchQueryPlan(query: string): ResearchQueryPlan {
  const folded = foldText(query.trim());
  const rawTokens = folded.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens = rawTokens.filter((token) => token.length > 1 && !STOPWORDS.has(token));
  const spanishMarks = /[áéíóúñü¿¡]/i.test(query);
  const esHints = rawTokens.filter((token) =>
    ["que", "quien", "como", "una", "los", "las", "del", "qué", "quién", "cómo"].includes(token),
  ).length;
  const enHints = rawTokens.filter((token) => ["what", "who", "how", "the", "is", "are"].includes(token)).length;
  const lang: "es" | "en" = spanishMarks || esHints >= enHints ? "es" : "en";
  return { lang, core: tokens.join(" ") || query.trim(), tokens };
}

export function wikiTitleUrl(lang: string, title: string) {
  const path = title.trim().replaceAll(" ", "_");
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(path).replaceAll("%2F", "/")}`;
}

export function wikipediaPageFromUrl(raw: string): { lang: string; title: string } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const lang = host.match(/^([a-z]{2,3})\.wikipedia\.org$/);
    if (!lang) return null;
    const path = url.pathname.match(/^\/wiki\/(.+)$/);
    if (!path) return null;
    const title = decodeURIComponent(path[1].replaceAll("_", " ")).trim();
    if (!title || WIKI_SKIP_PREFIX.test(title)) return null;
    return { lang: lang[1], title };
  } catch {
    return null;
  }
}

function isWikipediaHost(host: string) {
  return host.toLowerCase().endsWith("wikipedia.org");
}

export function usablePublicUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = decodeEntities(raw.trim());
  let parsed: URL;
  try {
    parsed = new URL(cleaned, "https://duckduckgo.com");
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (SEARCH_WRAPPER_HOSTS.has(host) || host.endsWith(".duckduckgo.com")) return null;
  if (!parsed.hostname.includes(".")) return null;
  return parsed.toString();
}

export function classifySource(hit: Pick<SearchHit, "url" | "sourceHost">): SourceKind {
  const host = hit.sourceHost.toLowerCase();
  const path = (() => {
    try {
      return new URL(hit.url).pathname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host.endsWith("wikipedia.org") || host.endsWith("wikidata.org") || host.endsWith("wikimedia.org")) {
    return "encyclopedia";
  }
  if (host.endsWith(".gov") || host.endsWith(".gob") || host.endsWith(".gob.mx") || host.endsWith(".edu")) {
    return "official";
  }
  if (
    host.includes("arxiv") ||
    host.includes("pubmed") ||
    host.includes("doi.org") ||
    host.includes("jstor") ||
    host.includes("ssrn")
  ) {
    return "research";
  }
  if (host.includes("news.ycombinator") || host.includes("reddit.com") || host.includes("stackexchange") || host.includes("stackoverflow")) {
    return "discussion";
  }
  if (
    /\/(price|prices|markets?|quote|chart|ticker|ohlc|finance)\b/.test(path) ||
    /\b(price|markets?|finance|coin|stock|quote)\b/.test(host)
  ) {
    return "market";
  }
  if (/\/(news|article|press|blog|story)\b/.test(path) || /\bnews\b/.test(host)) {
    return "news";
  }
  return "general";
}

function annotateHit(hit: SearchHit, provider?: string): SearchHit {
  return {
    ...hit,
    provider: hit.provider ?? provider,
    kind: hit.kind ?? classifySource(hit),
  };
}

export function hitsFromMediaWikiSearch(
  lang: string,
  data: unknown,
  limit = 5,
): SearchHit[] {
  const search = (
    data as {
      query?: { search?: Array<{ title?: string; snippet?: string }> };
    }
  )?.query?.search;
  if (!Array.isArray(search)) return [];
  const hits: SearchHit[] = [];
  for (const row of search.slice(0, limit)) {
    if (!row?.title || WIKI_SKIP_PREFIX.test(row.title)) continue;
    const url = wikiTitleUrl(lang, row.title);
    hits.push(
      annotateHit(
        {
          title: row.title,
          url,
          snippet: stripHtml(String(row.snippet ?? row.title)),
          sourceHost: hostOf(url),
        },
        "wikipedia",
      ),
    );
  }
  return hits;
}

export function extractFromMediaWikiPages(
  data: unknown,
): { title: string; extract: string } | null {
  const pages = (
    data as {
      query?: { pages?: Record<string, { title?: string; extract?: string; missing?: unknown }> };
    }
  )?.query?.pages;
  if (!pages || typeof pages !== "object") return null;
  for (const page of Object.values(pages)) {
    if (!page || "missing" in page) continue;
    const extract = stripHtml(String(page.extract ?? "")).trim();
    if (extract.length < 40) continue;
    return { title: page.title || "Wikipedia", extract };
  }
  return null;
}

export function hitsFromHnAlgolia(data: unknown, limit = 6): SearchHit[] {
  const rows = (
    data as { hits?: Array<{ title?: string; url?: string; story_text?: string }> }
  )?.hits;
  if (!Array.isArray(rows)) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (hits.length >= limit) break;
    const usable = usablePublicUrl(row?.url);
    if (!usable) continue;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(
      annotateHit(
        {
          title: row.title || hostOf(usable),
          url: usable,
          snippet: String(row.story_text || row.title || "").slice(0, 280),
          sourceHost: hostOf(usable),
        },
        "hackernews",
      ),
    );
  }
  return hits;
}

function collectAnchorHits(
  html: string,
  className: string,
  provider: string,
  limit: number,
): SearchHit[] {
  const pattern = new RegExp(
    `<a\\b([^>]*class=['"][^'"]*${className}[^'"]*['"][^>]*)>([\\s\\S]*?)</a>`,
    "gi",
  );
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && hits.length < limit) {
    const attrs = match[1] ?? "";
    const href = attrs.match(/\bhref=['"]([^'"]+)['"]/i)?.[1];
    const raw = unwrapDuckLink(decodeEntities(href ?? ""));
    const usable = usablePublicUrl(raw);
    if (!usable) continue;
    const title = stripHtml(match[2] ?? "");
    if (!title) continue;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 500);
    const snippetRaw = after.match(/class=['"][^'"]*result-snippet[^'"]*['"][^>]*>([\s\S]*?)<\//i);
    hits.push(
      annotateHit(
        {
          title,
          url: usable,
          snippet: stripHtml(snippetRaw?.[1] ?? title).slice(0, 280),
          sourceHost: hostOf(usable),
        },
        provider,
      ),
    );
  }
  return hits;
}

export function hitsFromDuckHtml(html: string, limit = 8): SearchHit[] {
  return collectAnchorHits(html, "result__a", "duckduckgo-html", limit);
}

export function hitsFromDuckLite(html: string, limit = 8): SearchHit[] {
  const fromClass = collectAnchorHits(html, "result-link", "duckduckgo-lite", limit);
  if (fromClass.length) return fromClass;
  const hrefs = html.matchAll(/href=['"]([^'"]*uddg=https?[^'"]+)['"]/gi);
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const match of hrefs) {
    if (hits.length >= limit) break;
    const raw = unwrapDuckLink(decodeEntities(match[1] ?? ""));
    const usable = usablePublicUrl(raw);
    if (!usable) continue;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(
      annotateHit(
        {
          title: hostOf(usable),
          url: usable,
          snippet: hostOf(usable),
          sourceHost: hostOf(usable),
        },
        "duckduckgo-lite",
      ),
    );
  }
  return hits;
}

function walkDuckTopics(
  topics: unknown,
  push: (title: string, url: string, snippet: string) => void,
) {
  if (!Array.isArray(topics)) return;
  for (const topic of topics) {
    if (!topic || typeof topic !== "object") continue;
    const row = topic as { FirstURL?: string; Text?: string; Topics?: unknown };
    if (row.FirstURL) push(String(row.Text || ""), row.FirstURL, String(row.Text || ""));
    if (row.Topics) walkDuckTopics(row.Topics, push);
  }
}

export function hitsFromDuckInstantAnswer(data: unknown, limit = 8): SearchHit[] {
  if (!data || typeof data !== "object") return [];
  const row = data as Record<string, unknown>;
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const push = (title: string, url: string, snippet: string) => {
    if (hits.length >= limit) return;
    const usable = usablePublicUrl(url);
    if (!usable) return;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) return;
    seen.add(key);
    hits.push(
      annotateHit(
        {
          title: title || hostOf(usable),
          url: usable,
          snippet: snippet.slice(0, 280),
          sourceHost: hostOf(usable),
        },
        "duckduckgo-ia",
      ),
    );
  };
  if (typeof row.AbstractURL === "string") {
    push(
      String(row.Heading || row.AbstractSource || ""),
      row.AbstractURL,
      String(row.AbstractText || row.Abstract || ""),
    );
  }
  if (typeof row.OfficialWebsite === "string") {
    push(String(row.Heading || "Sitio oficial"), row.OfficialWebsite, "Sitio oficial según Instant Answer.");
  }
  walkDuckTopics(row.Results, push);
  walkDuckTopics(row.RelatedTopics, push);
  return hits;
}

function innerXml(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

export function hitsFromGoogleNewsRss(xml: string, limit = 8): SearchHit[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (hits.length >= limit) break;
    const title = innerXml(item, "title");
    const link = innerXml(item, "link");
    const sourceUrl = item.match(/<source[^>]*url=["']([^"']+)["'][^>]*>/i)?.[1];
    const usable = usablePublicUrl(link) ?? usablePublicUrl(sourceUrl);
    if (!usable) continue;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const snippet = innerXml(item, "description") || title;
    hits.push(
      annotateHit(
        {
          title: title || hostOf(usable),
          url: usable,
          snippet: snippet.slice(0, 280),
          sourceHost: hostOf(usable),
        },
        "google-news",
      ),
    );
  }
  return hits;
}

export function hitsFromExplicitUrls(query: string, urls: string[]): SearchHit[] {
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const usable = usablePublicUrl(raw);
    if (!usable) continue;
    const key = usable.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(
      annotateHit(
        {
          title: hostOf(usable),
          url: usable,
          snippet: `URL citada en el objetivo: ${query.slice(0, 120)}`,
          sourceHost: hostOf(usable),
        },
        "url-explícita",
      ),
    );
  }
  return hits;
}

export function mergeHits(groups: SearchHit[][], limit = 16): SearchHit[] {
  const merged: SearchHit[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const hit of group) {
      const usable = usablePublicUrl(hit.url);
      if (!usable) continue;
      const key = usable.replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...hit, url: usable, sourceHost: hit.sourceHost || hostOf(usable) });
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

function titleTokenHits(title: string, plan: ResearchQueryPlan): number {
  const folded = foldText(title);
  return plan.tokens.filter((token) => folded.includes(token)).length;
}

export function scoreHit(hit: SearchHit, plan: ResearchQueryPlan): number {
  const title = foldText(hit.title);
  const snippet = foldText(hit.snippet);
  if (!plan.tokens.length) return 1;
  const titleOverlap = plan.tokens.filter((token) => title.includes(token)).length;
  const snippetOverlap = plan.tokens.filter((token) => snippet.includes(token)).length;
  if (titleOverlap === 0 && snippetOverlap === 0) return 0;
  let score = titleOverlap * 12 + snippetOverlap * 2;
  if (title === plan.core) score += 80;
  else if (title.startsWith(plan.core)) score += 40;
  else if (title.split(/[^\p{L}\p{N}]+/u)[0] === plan.tokens[0]) score += 18;
  const host = hit.sourceHost.toLowerCase();
  if (isWikipediaHost(host)) score += 2;
  if (titleOverlap === 0 && isWikipediaHost(hit.sourceHost)) score -= 8;
  return score;
}

export function rankHits(hits: SearchHit[], query: string, limit = 8): SearchHit[] {
  const plan = researchQueryPlan(query);
  const scored = hits.map((hit) => ({
    hit,
    score: scoreHit(hit, plan),
    titleHits: titleTokenHits(hit.title, plan),
  }));
  scored.sort((a, b) => b.score - a.score || a.hit.title.localeCompare(b.hit.title));
  const wikiHasTitle = scored.some((row) => row.titleHits > 0 && isWikipediaHost(row.hit.sourceHost));
  const relevant = scored.filter((row) => {
    if (row.score <= 0) return false;
    if (wikiHasTitle && isWikipediaHost(row.hit.sourceHost) && row.titleHits === 0) return false;
    return true;
  });
  const chosen = relevant.length ? relevant : scored.filter((row) => row.score > 0);
  const fallback = chosen.length ? chosen : scored;
  const out: SearchHit[] = [];
  const seen = new Set<string>();
  for (const row of fallback) {
    const key = row.hit.url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.hit);
    if (out.length >= limit) break;
  }
  return out;
}

export function isShallowHome(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/" || parsed.pathname === "";
  } catch {
    return true;
  }
}

export function needsBroaderWeb(hits: SearchHit[]): boolean {
  const substantial = hits.filter(
    (hit) => !isShallowHome(hit.url) && !isWikipediaHost(hit.sourceHost),
  );
  const hosts = new Set(substantial.map((hit) => hit.sourceHost.toLowerCase()));
  return substantial.length < 3 || hosts.size < 2;
}

export function selectDiverseHits(
  hits: SearchHit[],
  query: string,
  opts?: { limit?: number; maxPerHost?: number },
): SearchHit[] {
  const limit = opts?.limit ?? 10;
  const maxPerHost = opts?.maxPerHost ?? 2;
  const ranked = rankHits(hits, query, Math.max(limit * 3, 24));
  const out: SearchHit[] = [];
  const perHost = new Map<string, number>();
  for (const hit of ranked) {
    const host = hit.sourceHost.toLowerCase();
    const count = perHost.get(host) ?? 0;
    if (count >= maxPerHost) continue;
    perHost.set(host, count + 1);
    out.push(annotateHit(hit));
    if (out.length >= limit) break;
  }
  return out.length ? out : ranked.slice(0, limit).map((hit) => annotateHit(hit));
}

export type ProviderAttempt = {
  name: string;
  hits: SearchHit[];
  error?: string;
  httpFailed?: boolean;
};

export function toProviderProbe(attempt: ProviderAttempt): ProviderProbe {
  if (attempt.hits.length) {
    return {
      name: attempt.name,
      status: "ok",
      hitCount: attempt.hits.length,
      recoverable: true,
    };
  }
  if (attempt.httpFailed) {
    return {
      name: attempt.name,
      status: "fail",
      hitCount: 0,
      error: attempt.error,
      recoverable: true,
    };
  }
  if (attempt.error && /bloquead|BLOCKED|autorizado|privada/i.test(attempt.error)) {
    return {
      name: attempt.name,
      status: "blocked",
      hitCount: 0,
      error: attempt.error,
      recoverable: false,
    };
  }
  return {
    name: attempt.name,
    status: "empty",
    hitCount: 0,
    error: attempt.error,
    recoverable: true,
  };
}

export function assembleDiscovery(
  queries: string[],
  probes: ProviderProbe[],
  ranked: SearchHit[],
  found: SearchHit[],
): DiscoveryReport {
  const domains = [...new Set(ranked.map((hit) => hit.sourceHost.toLowerCase()))];
  const kinds: Partial<Record<SourceKind, number>> = {};
  for (const hit of ranked) {
    const kind = hit.kind ?? classifySource(hit);
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }
  return {
    queries,
    providers: probes,
    found: found.length,
    usable: ranked.length,
    domains,
    kinds,
  };
}

export function emptyDiscovery(query: string, error?: string): DiscoveryReport {
  return {
    queries: query ? [query] : [],
    providers: error
      ? [{ name: "planner", status: "fail", hitCount: 0, error, recoverable: false }]
      : [],
    found: 0,
    usable: 0,
    domains: [],
    kinds: {},
  };
}

export function formatIncompleteReason(discovery: DiscoveryReport, phase = "descubrimiento"): string {
  const providerLines = discovery.providers.map((probe) => {
    if (probe.status === "ok") return `${probe.name}: ${probe.hitCount} pista(s)`;
    return `${probe.name}: ${probe.error || "sin resultados utilizables"}`;
  });
  const queries = discovery.queries.length ? `Consultas: ${discovery.queries.join(" · ")}.` : "";
  const body = providerLines.length ? providerLines.join(". ") : "ningún proveedor devolvió pistas";
  return `Investigación incompleta en ${phase}. ${queries} ${body}. Fuentes encontradas: ${discovery.found}. Utilizables: ${discovery.usable}. Dominios: ${discovery.domains.length}.`.replace(
    /\s+/g,
    " ",
  ).trim();
}

export function finalizeSearch(
  query: string,
  queries: string[],
  attempts: ProviderAttempt[],
): SearchResult {
  const found = mergeHits(
    attempts.map((attempt) => attempt.hits),
    40,
  );
  const ranked = selectDiverseHits(found, query, { limit: 10, maxPerHost: 2 });
  const probes = attempts.map(toProviderProbe);
  const discovery = assembleDiscovery(queries, probes, ranked, found);
  if (ranked.length) {
    const sources = probes.filter((probe) => probe.status === "ok").map((probe) => probe.name);
    return {
      ok: true,
      hits: ranked,
      provider: sources.join("+") || "public-web",
      discovery,
    };
  }
  const failed = probes.some((probe) => probe.status === "fail");
  return {
    ok: false,
    status: failed ? "FAIL" : "BLOCKED",
    error: formatIncompleteReason(discovery),
    discovery,
  };
}
