import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { sha256Hex } from "@/lib/kernel/hash";
import { hostOf } from "@/lib/utils";
import { completeAI, envKeysFromProcess } from "@/lib/ai/complete";
import { DEFAULT_SELECTION } from "@/lib/ai/catalog";
import type { AISelection } from "@/lib/ai/types";
import {
  excerptOf,
  extractReadableText,
  formatStructuredDocument,
  isStructuredContentType,
  readBounded,
  titleFromHtml,
} from "./extract";
import { planResearch, urlsMentioned } from "./planner";
import {
  extractFromMediaWikiPages,
  finalizeSearch,
  hitsFromDuckHtml,
  hitsFromDuckInstantAnswer,
  hitsFromDuckLite,
  hitsFromExplicitUrls,
  hitsFromGoogleNewsRss,
  hitsFromHnAlgolia,
  hitsFromMediaWikiSearch,
  mergeHits,
  needsBroaderWeb,
  wikipediaPageFromUrl,
  wikiTitleUrl,
  emptyDiscovery,
  type ProviderAttempt,
} from "./search-parse";
import type { SearchHit, SearchResult } from "./io";

type ReadResult =
  | {
      ok: true;
      url: string;
      title: string;
      sourceHost: string;
      excerpt: string;
      contentHash: string;
      httpStatus: number;
      bytes: number;
      retrievedAt: string;
    }
  | { ok: false; status: "BLOCKED" | "FAIL"; error: string; url: string };

type InterpretedFinding = {
  title: string;
  answer: string;
  whyItMatters: string;
  confidence: "low" | "medium" | "high";
  evidenceIndexes: number[];
  uncertainties: string[];
  nextAction: string;
  memoryRelation?: "novel" | "confirmed" | "tension";
  memoryNote?: string;
};

type InterpretResult =
  | { ok: true; available: true; findings: InterpretedFinding[]; invocation?: import("@/lib/ai/types").AIInvocation }
  | { ok: true; available: false; reason: string; invocation?: import("@/lib/ai/types").AIInvocation }
  | { ok: false; status: "BLOCKED" | "FAIL"; error: string; invocation?: import("@/lib/ai/types").AIInvocation };

const FETCH_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
  "user-agent": "Efesto-Kernel/1.0 (local-first research; +https://efesto-kernel.vercel.app)",
};

type AdapterResult = ProviderAttempt;

async function wikipediaHits(query: string): Promise<AdapterResult> {
  const langs = ["es", "en"] as const;
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_ORIGIN_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  const settled = await Promise.all(
    langs.map(async (lang) => {
      try {
        const endpoint = new URL(`https://${lang}.wikipedia.org/w/api.php`);
        endpoint.searchParams.set("action", "query");
        endpoint.searchParams.set("list", "search");
        endpoint.searchParams.set("srsearch", query);
        endpoint.searchParams.set("srlimit", "5");
        endpoint.searchParams.set("srnamespace", "0");
        endpoint.searchParams.set("format", "json");
        const start = await assertPublicHttpsUrl(endpoint.toString());
        const { response: res } = await fetchPublicHttps(start, {
          headers: FETCH_HEADERS,
          timeoutMs: SEARCH_ORIGIN_TIMEOUT_MS,
        });
        if (!res.ok) {
          return {
            hits: [] as SearchHit[],
            error: `Wikipedia (${lang}) devolvió HTTP ${res.status}.`,
            httpFailed: true,
          };
        }
        const data = (await res.json()) as unknown;
        const hits = hitsFromMediaWikiSearch(lang, data);
        return {
          hits,
          error: hits.length ? undefined : `Wikipedia (${lang}) no encontró páginas para esta consulta.`,
          httpFailed: false,
        };
      } catch (error) {
        return {
          hits: [] as SearchHit[],
          error: `Wikipedia (${lang}): ${describePublicFetchError(error)}`,
          httpFailed: true,
        };
      }
    }),
  );
  const hits = mergeHits(settled.map((row) => row.hits));
  const error = hits.length ? undefined : settled.map((row) => row.error).find(Boolean);
  return {
    name: "wikipedia",
    hits,
    error,
    httpFailed: !hits.length && settled.some((row) => row.httpFailed),
  };
}

async function hnHits(query: string): Promise<AdapterResult> {
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_AUX_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  try {
    const endpoint = new URL("https://hn.algolia.com/api/v1/search");
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("hitsPerPage", "6");
    endpoint.searchParams.set("tags", "story");
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: SEARCH_AUX_TIMEOUT_MS,
    });
    if (!res.ok) {
      return { name: "hackernews", hits: [], error: `Hacker News devolvió HTTP ${res.status}.`, httpFailed: true };
    }
    const data = (await res.json()) as unknown;
    const hits = hitsFromHnAlgolia(data);
    return {
      name: "hackernews",
      hits,
      error: hits.length ? undefined : "Hacker News no devolvió URLs https utilizables.",
    };
  } catch (error) {
    return { name: "hackernews", hits: [], error: `Hacker News: ${describePublicFetchError(error)}`, httpFailed: true };
  }
}

async function duckInstantHits(query: string): Promise<AdapterResult> {
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_AUX_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  try {
    const endpoint = new URL("https://api.duckduckgo.com/");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("no_redirect", "1");
    endpoint.searchParams.set("no_html", "1");
    endpoint.searchParams.set("skip_disambig", "1");
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: SEARCH_AUX_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        name: "duckduckgo-ia",
        hits: [],
        error: `DuckDuckGo Instant Answer devolvió HTTP ${res.status}.`,
        httpFailed: true,
      };
    }
    const data = (await res.json()) as unknown;
    const hits = hitsFromDuckInstantAnswer(data);
    return {
      name: "duckduckgo-ia",
      hits,
      error: hits.length ? undefined : "DuckDuckGo Instant Answer no devolvió URLs utilizables.",
    };
  } catch (error) {
    return {
      name: "duckduckgo-ia",
      hits: [],
      error: `DuckDuckGo Instant Answer: ${describePublicFetchError(error)}`,
      httpFailed: true,
    };
  }
}

async function googleNewsHits(query: string, lang: "es" | "en"): Promise<AdapterResult> {
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_AUX_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  try {
    const endpoint = new URL("https://news.google.com/rss/search");
    endpoint.searchParams.set("q", query);
    if (lang === "es") {
      endpoint.searchParams.set("hl", "es");
      endpoint.searchParams.set("gl", "ES");
      endpoint.searchParams.set("ceid", "ES:es");
    } else {
      endpoint.searchParams.set("hl", "en-US");
      endpoint.searchParams.set("gl", "US");
      endpoint.searchParams.set("ceid", "US:en");
    }
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: SEARCH_AUX_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        name: "google-news",
        hits: [],
        error: `Google News devolvió HTTP ${res.status}.`,
        httpFailed: true,
      };
    }
    const { text } = await readBounded(res, 400_000);
    const hits = hitsFromGoogleNewsRss(text);
    return {
      name: "google-news",
      hits,
      error: hits.length ? undefined : "Google News no devolvió URLs utilizables.",
    };
  } catch (error) {
    return {
      name: "google-news",
      hits: [],
      error: `Google News: ${describePublicFetchError(error)}`,
      httpFailed: true,
    };
  }
}

async function duckLiteHits(query: string): Promise<AdapterResult> {
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_ORIGIN_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  try {
    const endpoint = new URL("https://lite.duckduckgo.com/lite/");
    endpoint.searchParams.set("q", query);
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: SEARCH_ORIGIN_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        name: "duckduckgo-lite",
        hits: [],
        error: `DuckDuckGo Lite devolvió HTTP ${res.status}.`,
        httpFailed: true,
      };
    }
    const { text } = await readBounded(res, 900_000);
    const hits = hitsFromDuckLite(text);
    return {
      name: "duckduckgo-lite",
      hits,
      error: hits.length ? undefined : "DuckDuckGo Lite no devolvió URLs utilizables.",
    };
  } catch (error) {
    return {
      name: "duckduckgo-lite",
      hits: [],
      error: `DuckDuckGo Lite: ${describePublicFetchError(error)}`,
      httpFailed: true,
    };
  }
}

async function duckHtmlHits(query: string): Promise<AdapterResult> {
  const { assertPublicHttpsUrl, fetchPublicHttps, SEARCH_AUX_TIMEOUT_MS, describePublicFetchError } =
    await import("./ssrf");
  try {
    const endpoint = new URL("https://html.duckduckgo.com/html/");
    endpoint.searchParams.set("q", query);
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: SEARCH_AUX_TIMEOUT_MS,
    });
    if (!res.ok) {
      return {
        name: "duckduckgo-html",
        hits: [],
        error: `DuckDuckGo devolvió HTTP ${res.status}.`,
        httpFailed: true,
      };
    }
    const { text } = await readBounded(res, 900_000);
    const hits = hitsFromDuckHtml(text);
    return {
      name: "duckduckgo-html",
      hits,
      error: hits.length ? undefined : "DuckDuckGo no devolvió pistas utilizables.",
    };
  } catch (error) {
    return {
      name: "duckduckgo-html",
      hits: [],
      error: `DuckDuckGo: ${describePublicFetchError(error)}`,
      httpFailed: true,
    };
  }
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* continue */
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function asFindingList(parsed: unknown): InterpretedFinding[] {
  if (!parsed || typeof parsed !== "object") return [];
  const findings = (parsed as { findings?: unknown }).findings;
  if (!Array.isArray(findings)) return [];
  return findings
    .slice(0, 3)
    .map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const confidence: InterpretedFinding["confidence"] =
        row.confidence === "high" ? "high" : row.confidence === "medium" ? "medium" : "low";
      const relation = row.memoryRelation;
      const memoryRelation: InterpretedFinding["memoryRelation"] =
        relation === "confirmed" || relation === "tension" || relation === "novel"
          ? relation
          : undefined;
      return {
        title: String(row.title ?? "").slice(0, 160),
        answer: String(row.answer ?? ""),
        whyItMatters: String(row.whyItMatters ?? ""),
        confidence,
        evidenceIndexes: Array.isArray(row.evidenceIndexes)
          ? row.evidenceIndexes.filter((n): n is number => typeof n === "number")
          : [],
        uncertainties: Array.isArray(row.uncertainties)
          ? row.uncertainties.map(String)
          : [],
        nextAction: String(row.nextAction ?? ""),
        memoryRelation,
        memoryNote: row.memoryNote ? String(row.memoryNote).slice(0, 280) : undefined,
      };
    })
    .filter((item) => item.answer || item.title);
}

export const searchPublicWeb = createServerFn({ method: "POST" })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }): Promise<SearchResult> => {
    const query = data.query.trim();
    if (query.length < 2) {
      return {
        ok: false,
        status: "FAIL",
        error: "El objetivo es demasiado corto.",
        discovery: emptyDiscovery(query, "El objetivo es demasiado corto."),
      };
    }
    const plan = planResearch(query);
    const attempts: ProviderAttempt[] = [];
    const explicit = hitsFromExplicitUrls(query, urlsMentioned(query));
    if (explicit.length) attempts.push({ name: "url-explícita", hits: explicit });

    const wikiQuery = plan.compactQuery || plan.webQuery;
    const [wiki, hn, instant, news, lite] = await Promise.all([
      wikipediaHits(wikiQuery),
      hnHits(plan.webQuery),
      duckInstantHits(plan.entityQuery || plan.webQuery),
      googleNewsHits(plan.webQuery, plan.lang),
      duckLiteHits(plan.webQuery),
    ]);
    attempts.push(wiki, hn, instant, news, lite);

    if (!wiki.hits.length && plan.compactQuery && plan.compactQuery !== wikiQuery) {
      const wikiRetry = await wikipediaHits(plan.compactQuery);
      attempts.push({ ...wikiRetry, name: "wikipedia-alt" });
    }

    let collected = mergeHits(attempts.map((attempt) => attempt.hits), 40);
    if (needsBroaderWeb(collected)) {
      if (plan.compactQuery !== plan.webQuery) {
        const liteAlt = await duckLiteHits(plan.compactQuery);
        attempts.push({ ...liteAlt, name: "duckduckgo-lite-alt" });
        collected = mergeHits([collected, liteAlt.hits], 40);
      }
      if (needsBroaderWeb(collected)) {
        attempts.push(await duckHtmlHits(plan.webQuery));
      }
    }

    return finalizeSearch(query, plan.queries, attempts);
  });

async function readWikipediaExtract(page: { lang: string; title: string }): Promise<ReadResult | null> {
  try {
    const { assertPublicHttpsUrl, fetchPublicHttps, FETCH_TIMEOUT_MS } =
      await import("./ssrf");
    const endpoint = new URL(`https://${page.lang}.wikipedia.org/w/api.php`);
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("prop", "extracts");
    endpoint.searchParams.set("explaintext", "1");
    endpoint.searchParams.set("redirects", "1");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("titles", page.title);
    const start = await assertPublicHttpsUrl(endpoint.toString());
    const { response: res } = await fetchPublicHttps(start, {
      headers: FETCH_HEADERS,
      timeoutMs: FETCH_TIMEOUT_MS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    const extracted = extractFromMediaWikiPages(data);
    if (!extracted) return null;
    const excerpt = excerptOf(extracted.extract);
    const url = wikiTitleUrl(page.lang, extracted.title || page.title);
    return {
      ok: true,
      url,
      title: extracted.title,
      sourceHost: hostOf(url),
      excerpt,
      contentHash: await sha256Hex(extracted.extract),
      httpStatus: res.status,
      bytes: extracted.extract.length,
      retrievedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export const readPublicWeb = createServerFn({ method: "POST" })
  .validator((input: { url: string }) => input)
  .handler(async ({ data }): Promise<ReadResult> => {
    try {
      const { assertPublicHttpsUrl, fetchPublicHttps, FETCH_LIMIT_BYTES, FETCH_TIMEOUT_MS } =
        await import("./ssrf");
      const wikiPage = wikipediaPageFromUrl(data.url);
      if (wikiPage) {
        const extracted = await readWikipediaExtract(wikiPage);
        if (extracted?.ok) return extracted;
      }
      const url = await assertPublicHttpsUrl(data.url);
      const { response: res, url: finalUrl } = await fetchPublicHttps(url, {
        headers: FETCH_HEADERS,
        timeoutMs: FETCH_TIMEOUT_MS,
      });
      if (!res.ok) {
        return {
          ok: false,
          status: "FAIL",
          error: `La fuente devolvió HTTP ${res.status}.`,
          url: finalUrl,
        };
      }
      const { text, bytes } = await readBounded(res, FETCH_LIMIT_BYTES);
      const contentType = res.headers.get("content-type") || "";
      const retrievedAt = new Date().toISOString();
      if (isStructuredContentType(contentType) || looksLikeJson(text)) {
        const document = formatStructuredDocument({
          text,
          contentType: contentType || "application/json",
          url: finalUrl,
          retrievedAt,
        });
        const excerpt = excerptOf(document);
        if (excerpt.length < 40) {
          return {
            ok: false,
            status: "FAIL",
            error: "La fuente estructurada no devolvió contenido observable.",
            url: finalUrl,
          };
        }
        return {
          ok: true,
          url: finalUrl,
          title: titleFromHtml(text) || hostOf(finalUrl),
          sourceHost: hostOf(finalUrl),
          excerpt,
          contentHash: await sha256Hex(document),
          httpStatus: res.status,
          bytes,
          retrievedAt,
        };
      }
      const stripped = extractReadableText(text);
      const excerpt = excerptOf(stripped);
      if (excerpt.length < 40) {
        return {
          ok: false,
          status: "FAIL",
          error: "La página no devolvió texto observable.",
          url: finalUrl,
        };
      }
      return {
        ok: true,
        url: finalUrl,
        title: titleFromHtml(text) || hostOf(finalUrl),
        sourceHost: hostOf(finalUrl),
        excerpt,
        contentHash: await sha256Hex(stripped),
        httpStatus: res.status,
        bytes,
        retrievedAt,
      };
    } catch (error) {
      const { describePublicFetchError } = await import("./ssrf");
      return {
        ok: false,
        status: "BLOCKED",
        error: describePublicFetchError(error),
        url: data.url,
      };
    }
  });

function looksLikeJson(text: string) {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

export const interpretEvidence = createServerFn({ method: "POST" })
  .validator(
    (input: {
      goal: string;
      evidence: Array<{ title: string; url: string; excerpt: string }>;
      memory?: Array<{ title: string; why: string }>;
      parentSeal?: {
        goal: string;
        executive: string;
        findings: Array<{ title: string; answer: string }>;
      };
      selection?: AISelection;
    }) => input,
  )
  .handler(async ({ data }): Promise<InterpretResult> => {
    const payload = data.evidence.slice(0, 6).map((item, index) => ({
      index,
      title: item.title,
      url: item.url,
      excerpt: item.excerpt.slice(0, 5000),
    }));
    const durableMemory = (data.memory ?? []).slice(0, 3);
    const selection = data.selection ?? {
      provider: DEFAULT_SELECTION.provider,
      model: DEFAULT_SELECTION.model,
    };
    const result = await completeAI({
      task: "interpret",
      operation: "interpret",
      json: true,
      temperature: 0.2,
      maxTokens: 1400,
      selection,
      envKeys: envKeysFromProcess(),
      messages: [
        {
          role: "system",
          content:
            'Eres la capa de interpretación de Efesto. NO creas evidencia. Solo interpretas extractos ya recuperados. La memoria durable NO es evidencia de este caso: no la cites como fuente. Puedes usarla para clasificar el delta. El campo answer es SOLO la interpretación: 2 a 5 frases. NO copies extractos. NO escribas las etiquetas DATOS OBSERVADOS, MÉTRICAS, ANÁLISIS, ESCENARIOS ni INCERTIDUMBRE dentro de answer. Lo observado vive en los extractos. Lo incierto va en uncertainties. Un escenario futuro es incertidumbre, nunca un hecho. Responde JSON: {"findings":[{"title":"","answer":"","whyItMatters":"","confidence":"low|medium|high","evidenceIndexes":[0],"uncertainties":[""],"nextAction":"","memoryRelation":"novel|confirmed|tension","memoryNote":""}]}',
        },
        {
          role: "user",
          content: JSON.stringify({
            goal: data.goal,
            evidence: payload,
            durableMemory,
            parentSeal: data.parentSeal
              ? {
                  goal: data.parentSeal.goal,
                  executive: data.parentSeal.executive,
                  findings: data.parentSeal.findings.slice(0, 3),
                }
              : null,
            rules: [
              "Cada afirmación debe ser sostenida por los extractos de evidencia.",
              "Si los extractos no responden, dilo y baja la confianza.",
              "Nunca inventes URLs, precios, series ni hechos ausentes.",
              "La memoria durable no sustituye evidencia.",
              "memoryRelation es relativo a durableMemory, no a la evidencia.",
              "tension solo si el extracto contradice un hecho concreto de la memoria; explica el conflicto en memoryNote.",
              "confirmed si la evidencia nueva sostiene lo ya admitido.",
              "novel si aporta material que la memoria no cubría.",
              "Si durableMemory está vacío, omite memoryRelation.",
              "El dosier padre no es evidencia de este caso ni memoria admitida.",
              "No cites el dosier padre como fuente. Cada afirmación exige extractos de ESTE caso.",
              "No uses memoryRelation contra el dosier padre.",
              "answer es interpretación, no un informe con secciones.",
              "No escribas DATOS OBSERVADOS ni ANÁLISIS dentro de answer.",
              "No copies los extractos en answer; el Kernel ya los retiene.",
              "Separa datos observados de análisis. Un escenario futuro es incertidumbre, no un hecho.",
              "Si el objetivo pide pronosticar, dilo como escenario y explica por qué los extractos no determinan el futuro.",
              "Máximo 3 findings.",
            ],
          }),
        },
      ],
    });
    if (!result.ok) {
      if (result.status === "BLOCKED") {
        return {
          ok: true,
          available: false,
          reason: result.error || "Interpretación con modelo no disponible en este entorno.",
          invocation: result.invocation,
        };
      }
      return { ok: false, status: result.status, error: result.error, invocation: result.invocation };
    }
    const parsed = extractJson(result.text);
    const findings = asFindingList(parsed).map((item) => ({
      ...item,
      evidenceIndexes: item.evidenceIndexes.filter((n) => n < payload.length),
    }));
    return { ok: true, available: true, findings, invocation: result.invocation };
  });

export const chatPrivately = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      selection?: AISelection;
    }) => input,
  )
  .handler(async ({ data }) => {
    const selection = data.selection ?? {
      provider: DEFAULT_SELECTION.provider,
      model: DEFAULT_SELECTION.model,
    };
    const result = await completeAI({
      task: "chat",
      operation: "chat",
      temperature: 0.5,
      maxTokens: 700,
      selection,
      envKeys: envKeysFromProcess(),
      messages: [
        {
          role: "system",
          content:
            "Eres la conversación privada de Efesto. Este chat NO es evidencia y NUNCA se convierte en memoria durable. Si el usuario quiere investigar la web, indícale el modo Objetivo. Sé preciso y calmado. Responde en el idioma del usuario.",
        },
        ...data.messages.slice(-8).map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        })),
      ],
    });
    if (!result.ok) {
      return {
        ok: false as const,
        status: result.status,
        error: result.error,
        invocation: result.invocation,
      };
    }
    return {
      ok: true as const,
      text: result.text,
      invocation: result.invocation,
    };
  });
