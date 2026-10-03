import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { useKernel } from "../kernel/store.ts";
import { itIsolated as itSerial } from "../kernel/test-isolate.ts";
import { runInvestigation } from "./run-investigation.ts";
import type { PublicReadResult, ResearchIO, SearchHit } from "./io.ts";
import {
  finalizeSearch,
  formatIncompleteReason,
  hitsFromDuckHtml,
  hitsFromDuckInstantAnswer,
  hitsFromDuckLite,
  hitsFromGoogleNewsRss,
  hitsFromHnAlgolia,
  hitsFromMediaWikiSearch,
  mergeHits,
  needsBroaderWeb,
  selectDiverseHits,
  toProviderProbe,
  usablePublicUrl,
} from "./search-parse.ts";

const AT = "2026-08-29T12:00:00.000Z";
const BTC_GOAL =
  "busca los precios de BTC desde 2010 hasta 2026 y analiza los escenarios posibles para 2026";

function hit(over: Partial<SearchHit> & Pick<SearchHit, "title" | "url">): SearchHit {
  return {
    snippet: over.snippet ?? over.title,
    sourceHost: over.sourceHost ?? new URL(over.url).hostname.replace(/^www\./, ""),
    ...over,
  };
}

function ioOf(over: {
  search?: ResearchIO["searchPublicWeb"];
  read?: ResearchIO["readPublicWeb"];
}): ResearchIO {
  return {
    searchPublicWeb:
      over.search ??
      (async () => ({
        ok: true as const,
        provider: "test",
        hits: [hit({ title: "Ficha", url: "https://example.com/a" })],
      })),
    readPublicWeb:
      over.read ??
      (async ({ data }): Promise<PublicReadResult> => ({
        ok: true,
        url: data.url,
        title: "Ficha",
        sourceHost: "example.com",
        excerpt: "Texto observable de una ficha pública con más de cuarenta caracteres útiles.",
        contentHash: "hash-public-observation",
        httpStatus: 200,
        bytes: 80,
        retrievedAt: AT,
      })),
    interpretEvidence: async () => ({
      ok: true,
      available: true,
      findings: [
        {
          title: "Observado",
          answer: "La ficha pública sostiene el hecho recuperado.",
          whyItMatters: "Hay evidencia.",
          confidence: "medium",
          evidenceIndexes: [0],
          uncertainties: ["Una sola fuente"],
          nextAction: "Inspeccionar",
        },
      ],
    }),
  };
}

describe("adapters: empty payloads do not invent hits", () => {
  it("Wikipedia empty search is empty", () => {
    assert.deepEqual(hitsFromMediaWikiSearch("es", { query: { search: [] } }), []);
    assert.deepEqual(hitsFromMediaWikiSearch("es", { query: { searchinfo: { totalhits: 0 } } }), []);
  });

  it("Hacker News without https URLs is empty", () => {
    assert.deepEqual(
      hitsFromHnAlgolia({
        hits: [{ title: "HTTP only", url: "http://example.com/x" }, { title: "no url" }],
      }),
      [],
    );
  });

  it("DuckDuckGo HTML without result__a is empty, not fake URLs", () => {
    const html = `<!DOCTYPE html><html><head><title>DuckDuckGo</title></head><body><p>challenge</p></body></html>`;
    assert.deepEqual(hitsFromDuckHtml(html), []);
  });

  it("DuckDuckGo Instant Answer without URLs is empty", () => {
    assert.deepEqual(hitsFromDuckInstantAnswer({ Abstract: "", RelatedTopics: [], Results: [] }), []);
  });
});

describe("usable URLs", () => {
  it("rejects invalid, http, and wrapper URLs", () => {
    assert.equal(usablePublicUrl("not a url"), null);
    assert.equal(usablePublicUrl("http://example.com/x"), null);
    assert.equal(usablePublicUrl("https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa"), null);
    assert.equal(usablePublicUrl("https://news.google.com/rss/articles/ABC"), null);
    assert.equal(usablePublicUrl("https://example.com/a"), "https://example.com/a");
  });
});

describe("DuckDuckGo Lite and Google News parsers", () => {
  it("unwraps lite result-link uddg targets", () => {
    const html = `
      <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fcharts.bitbo.io%2Fprice%2F&rut=abc" class='result-link'>Bitcoin Price History Chart</a>
      <td class='result-snippet'>First recorded price at $0.00099/BTC.</td>
    `;
    const hits = hitsFromDuckLite(html);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.url, "https://charts.bitbo.io/price/");
    assert.match(hits[0]?.title ?? "", /Bitcoin Price History/);
    assert.equal(hits[0]?.provider, "duckduckgo-lite");
  });

  it("does not invent article URLs from Google News wrappers", () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Complete timeline</title>
          <link>https://news.google.com/rss/articles/CBMiakF</link>
          <source url="https://www.coingecko.com">CoinGecko</source>
        </item>
        <item>
          <title>No source and wrapper only</title>
          <link>https://news.google.com/rss/articles/XXXX</link>
        </item>
        <item>
          <title>Direct publisher</title>
          <link>https://example.net/markets/history</link>
        </item>
      </channel></rss>
    `;
    const hits = hitsFromGoogleNewsRss(xml);
    assert.equal(hits.some((item) => item.sourceHost.includes("news.google")), false);
    assert.equal(hits.some((item) => item.url === "https://www.coingecko.com/"), true);
    assert.equal(hits.some((item) => item.url === "https://example.net/markets/history"), true);
    assert.equal(hits.some((item) => /XXXX/.test(item.url)), false);
  });
});

describe("fallback: do not stop when Wikipedia/HN/DDG HTML are empty", () => {
  const emptyWiki: SearchHit[] = [];
  const emptyHn: SearchHit[] = [];
  const emptyHtml: SearchHit[] = [];
  const liteHits = [
    hit({
      title: "Bitcoin Price History Chart (2009, 2010 to 2026)",
      url: "https://charts.bitbo.io/price/",
      snippet: "Historical BTC prices",
      provider: "duckduckgo-lite",
    }),
    hit({
      title: "Bitcoin price history",
      url: "https://www.bitcoin.com/get-started/bitcoin/basics/bitcoin-price-history/",
      snippet: "Timeline of bitcoin prices",
      provider: "duckduckgo-lite",
    }),
  ];

  it("continues when another provider returns usable URLs", () => {
    const result = finalizeSearch(
      "busca los precios de BTC desde 2010 hasta 2026 y calcula si subirá o no",
      ["precios btc 2010 2026"],
      [
        { name: "wikipedia", hits: emptyWiki, error: "Wikipedia (es) no encontró páginas para esta consulta." },
        { name: "hackernews", hits: emptyHn, error: "Hacker News no devolvió URLs https utilizables." },
        { name: "duckduckgo-html", hits: emptyHtml, error: "DuckDuckGo no devolvió pistas utilizables." },
        { name: "duckduckgo-lite", hits: liteHits },
      ],
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.hits.length >= 1, true);
    assert.equal(result.hits.some((item) => item.sourceHost === "charts.bitbo.io"), true);
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "wikipedia")?.status, "empty");
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "duckduckgo-lite")?.status, "ok");
  });

  it("does not fabricate success when every provider is empty", () => {
    const result = finalizeSearch(
      "busca los precios de BTC desde 2010 hasta 2026 y calcula si subirá o no",
      ["precios btc 2010 2026"],
      [
        { name: "wikipedia", hits: [], error: "Wikipedia (es) no encontró páginas para esta consulta." },
        { name: "hackernews", hits: [], error: "Hacker News no devolvió URLs https utilizables." },
        { name: "duckduckgo-html", hits: [], error: "DuckDuckGo no devolvió pistas utilizables." },
        { name: "duckduckgo-lite", hits: [], error: "DuckDuckGo Lite no devolvió URLs utilizables." },
      ],
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Investigación incompleta/);
    assert.match(result.error, /Wikipedia/);
    assert.match(result.error, /Hacker News/);
    assert.match(result.error, /DuckDuckGo/);
    assert.equal(result.discovery?.found, 0);
    assert.equal(result.discovery?.usable, 0);
  });

  it("one provider failing does not hide another provider's hits", () => {
    const result = finalizeSearch("wikipedia", ["wikipedia"], [
      { name: "wikipedia", hits: [], error: "Wikipedia (es) devolvió HTTP 503.", httpFailed: true },
      {
        name: "duckduckgo-ia",
        hits: [hit({ title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Wikipedia" })],
      },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.hits[0]?.sourceHost.endsWith("wikipedia.org"), true);
  });

  it("needs broader web when only encyclopedia or homepages exist", () => {
    assert.equal(
      needsBroaderWeb([
        hit({ title: "BTC", url: "https://en.wikipedia.org/wiki/BTC", sourceHost: "en.wikipedia.org" }),
        hit({ title: "CoinGecko", url: "https://www.coingecko.com/", sourceHost: "coingecko.com" }),
      ]),
      true,
    );
    assert.equal(
      needsBroaderWeb([
        hit({ title: "A", url: "https://a.example/price/2010", sourceHost: "a.example" }),
        hit({ title: "B", url: "https://b.example/markets/btc", sourceHost: "b.example" }),
        hit({ title: "C", url: "https://c.example/article/history", sourceHost: "c.example" }),
      ]),
      false,
    );
  });
});

describe("diversity", () => {
  it("caps hits per host so Wikipedia cannot occupy the whole set", () => {
    const ranked = selectDiverseHits(
      [
        hit({ title: "Wikipedia", url: "https://es.wikipedia.org/wiki/Wikipedia", sourceHost: "es.wikipedia.org" }),
        hit({ title: "Wikipedia en español", url: "https://es.wikipedia.org/wiki/Wikipedia_en_espa%C3%B1ol", sourceHost: "es.wikipedia.org" }),
        hit({ title: "Wikipedia (en)", url: "https://es.wikipedia.org/wiki/Wikipedia_(desambiguacion)", sourceHost: "es.wikipedia.org" }),
        hit({ title: "Show HN wiki tool", url: "https://example.net/wiki-tool", sourceHost: "example.net", snippet: "A tool that is not Wikipedia." }),
      ],
      "qué es Wikipedia",
      { limit: 4, maxPerHost: 2 },
    );
    assert.equal(ranked.filter((item) => item.sourceHost === "es.wikipedia.org").length <= 2, true);
    assert.equal(ranked.some((item) => item.sourceHost === "example.net"), true);
  });
});

const marketHit = hit({
  title: "Bitcoin Price History Chart (2009, 2010 to 2026)",
  url: "https://charts.bitbo.io/price/",
  snippet: "Historical BTC prices from 2010 to 2026",
  provider: "duckduckgo-lite",
});

describe("fallback gate A–F", () => {
  it("A Wikipedia falla → la investigación continúa con otro proveedor", () => {
    const result = finalizeSearch(BTC_GOAL, ["precios btc 2010 2026"], [
      { name: "wikipedia", hits: [], error: "Wikipedia (es) devolvió HTTP 503.", httpFailed: true },
      { name: "duckduckgo-lite", hits: [marketHit] },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "wikipedia")?.status, "fail");
    assert.equal(result.hits.some((item) => item.url === marketHit.url), true);
  });

  it("B Hacker News falla → la investigación continúa con otro proveedor", () => {
    const result = finalizeSearch(BTC_GOAL, ["precios btc 2010 2026"], [
      { name: "hackernews", hits: [], error: "Hacker News devolvió HTTP 403.", httpFailed: true },
      { name: "duckduckgo-lite", hits: [marketHit] },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "hackernews")?.status, "fail");
    assert.equal(result.hits.some((item) => item.url === marketHit.url), true);
  });

  it("C DuckDuckGo HTML HTTP 202/challenge → continúa por otro proveedor", () => {
    const challengeHtml = `<!DOCTYPE html><html><head><title>DuckDuckGo</title></head><body><p>challenge</p></body></html>`;
    assert.deepEqual(hitsFromDuckHtml(challengeHtml), []);
    const probe = toProviderProbe({
      name: "duckduckgo-html",
      hits: [],
      error: "DuckDuckGo devolvió HTTP 202.",
      httpFailed: true,
    });
    assert.equal(probe.status, "fail");
    const result = finalizeSearch(BTC_GOAL, ["precios btc 2010 2026"], [
      { name: "duckduckgo-html", hits: [], error: "DuckDuckGo devolvió HTTP 202.", httpFailed: true },
      { name: "duckduckgo-lite", hits: [marketHit] },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "duckduckgo-html")?.status, "fail");
    assert.equal(result.hits.some((item) => item.url === marketHit.url), true);
  });

  it("D un proveedor devuelve resultados con URLs no utilizables → continúa", () => {
    const parsedHn = hitsFromHnAlgolia({
      hits: [
        { title: "BTC thread", url: "http://old.example/btc" },
        { title: "wrapper", url: "https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa" },
      ],
    });
    assert.equal(parsedHn.length, 0);
    const wrappers = mergeHits([
      [
        hit({
          title: "News wrapper",
          url: "https://news.google.com/rss/articles/ABC",
          sourceHost: "news.google.com",
        }),
      ],
    ]);
    assert.equal(wrappers.length, 0);
    const result = finalizeSearch(BTC_GOAL, ["precios btc 2010 2026"], [
      { name: "hackernews", hits: parsedHn, error: "Hacker News no devolvió URLs https utilizables." },
      { name: "google-news", hits: wrappers, error: "Google News no devolvió URLs utilizables." },
      { name: "duckduckgo-lite", hits: [marketHit] },
    ]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.discovery?.providers.find((probe) => probe.name === "hackernews")?.status, "empty");
    assert.equal(result.hits.some((item) => item.url === marketHit.url), true);
  });

  it("E todos los proveedores fallan → Investigación incompleta, nunca Completado", () => {
    const result = finalizeSearch(BTC_GOAL, ["precios btc 2010 2026"], [
      { name: "wikipedia", hits: [], error: "Wikipedia (es) devolvió HTTP 503.", httpFailed: true },
      { name: "hackernews", hits: [], error: "Hacker News devolvió HTTP 403.", httpFailed: true },
      { name: "duckduckgo-html", hits: [], error: "DuckDuckGo devolvió HTTP 202.", httpFailed: true },
      { name: "duckduckgo-lite", hits: [], error: "DuckDuckGo Lite: fetch failed", httpFailed: true },
    ]);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Investigación incompleta/);
    assert.equal(/Completado/.test(result.error), false);
    assert.equal(result.discovery?.usable, 0);
  });
});

describe("runInvestigation honest failures", { concurrency: false }, () => {
  itSerial("blocks with Investigación incompleta when search returns no usable URLs", async () => {
    const goal = useKernel.getState().createGoal(BTC_GOAL);
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: false,
          status: "BLOCKED",
          error: formatIncompleteReason({
            queries: ["precios btc 2010 2026"],
            providers: [
              {
                name: "wikipedia",
                status: "empty",
                hitCount: 0,
                error: "Wikipedia (es) no encontró páginas para esta consulta.",
                recoverable: true,
              },
              {
                name: "hackernews",
                status: "empty",
                hitCount: 0,
                error: "Hacker News no devolvió URLs https utilizables.",
                recoverable: true,
              },
              {
                name: "duckduckgo-html",
                status: "empty",
                hitCount: 0,
                error: "DuckDuckGo no devolvió pistas utilizables.",
                recoverable: true,
              },
            ],
            found: 0,
            usable: 0,
            domains: [],
            kinds: {},
          }),
        }),
      }),
    );
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") return;
    assert.match(result.reason, /Investigación incompleta/);
    assert.match(result.reason, /Wikipedia \(es\) no encontró páginas/);
    const live = useKernel.getState().goals.find((item) => item.id === goal.id);
    assert.equal(live?.stage, "blocked");
    assert.equal(useKernel.getState().evidence.length, 0);
  });

  itSerial("E todos los proveedores fallan → Kernel blocked, no sello, no Completado", async () => {
    const goal = useKernel.getState().createGoal(BTC_GOAL);
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: false,
          status: "FAIL",
          error: formatIncompleteReason({
            queries: ["precios btc 2010 2026"],
            providers: [
              { name: "wikipedia", status: "fail", hitCount: 0, error: "Wikipedia HTTP 503", recoverable: true },
              { name: "hackernews", status: "fail", hitCount: 0, error: "HN HTTP 403", recoverable: true },
              { name: "duckduckgo-html", status: "fail", hitCount: 0, error: "DDG HTTP 202", recoverable: true },
            ],
            found: 0,
            usable: 0,
            domains: [],
            kinds: {},
          }),
        }),
      }),
    );
    assert.equal(result.status, "blocked");
    const live = useKernel.getState();
    const current = live.goals.find((item) => item.id === goal.id);
    assert.equal(current?.stage, "blocked");
    assert.notEqual(current?.status, "complete");
    assert.equal(live.evidence.length, 0);
    assert.equal(live.dossiers.length, 0);
    assert.match(current?.blockedReason ?? "", /Investigación incompleta/);
  });

  itSerial("keeps going when one lead fetch fails and another is valid", async () => {
    const goal = useKernel.getState().createGoal("Taladro 18-25 EUR");
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: true,
          provider: "test",
          hits: [
            hit({ title: "Roto", url: "https://broken.example/x", sourceHost: "broken.example" }),
            hit({ title: "Taladro 20 EUR", url: "https://example.com/drill", sourceHost: "example.com" }),
          ],
        }),
        read: async ({ data }): Promise<PublicReadResult> => {
          if (data.url.includes("broken")) {
            return { ok: false, status: "FAIL", error: "La fuente devolvió HTTP 502.", url: data.url };
          }
          return {
            ok: true,
            url: data.url,
            title: "Taladro 20 EUR",
            sourceHost: "example.com",
            excerpt: "El taladro percutor se ofrece a 20 EUR en la ficha pública de ferretería.",
            contentHash: "hash-drill-20-public",
            httpStatus: 200,
            bytes: 90,
            retrievedAt: AT,
          };
        },
      }),
    );
    assert.equal(result.status, "complete");
    assert.equal(useKernel.getState().evidence.length, 1);
    assert.equal(useKernel.getState().evidence[0]?.sourceHost, "example.com");
  });

  itSerial("SOURCE QUALITY: URL encontrada sin fetch/contenido no se admite como evidencia", async () => {
    const goal = useKernel.getState().createGoal(BTC_GOAL);
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: true,
          provider: "test",
          hits: [hit({ title: "BTC prices", url: "https://empty.example/btc", sourceHost: "empty.example" })],
        }),
        read: async ({ data }): Promise<PublicReadResult> => ({
          ok: false,
          status: "FAIL",
          error: "La página no devolvió texto observable.",
          url: data.url,
        }),
      }),
    );
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") return;
    assert.match(result.reason, /Investigación incompleta/);
    const live = useKernel.getState();
    assert.equal(live.evidence.length, 0);
    const current = live.goals.find((item) => item.id === goal.id);
    assert.equal(current?.leads.length, 1);
    assert.equal(current?.stage, "blocked");
  });

  itSerial("does not admit a source with insufficient content", async () => {
    const goal = useKernel.getState().createGoal("Taladro 18-25 EUR");
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        read: async ({ data }): Promise<PublicReadResult> => ({
          ok: false,
          status: "FAIL",
          error: "La página no devolvió texto observable.",
          url: data.url,
        }),
      }),
    );
    assert.equal(result.status, "blocked");
    if (result.status !== "blocked") return;
    assert.match(result.reason, /Investigación incompleta/);
    assert.equal(useKernel.getState().evidence.length, 0);
  });

  itSerial("F al menos un proveedor válido → la investigación llega al Kernel", async () => {
    const goal = useKernel.getState().createGoal(BTC_GOAL);
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: true,
          provider: "duckduckgo-lite",
          hits: [marketHit],
          discovery: {
            queries: ["precios btc 2010 2026"],
            providers: [
              { name: "wikipedia", status: "fail", hitCount: 0, error: "HTTP 503", recoverable: true },
              { name: "duckduckgo-lite", status: "ok", hitCount: 1, recoverable: true },
            ],
            found: 1,
            usable: 1,
            domains: ["charts.bitbo.io"],
            kinds: { market: 1 },
          },
        }),
        read: async ({ data }): Promise<PublicReadResult> => ({
          ok: true,
          url: data.url,
          title: "Bitcoin Price History Chart (2009, 2010 to 2026)",
          sourceHost: "charts.bitbo.io",
          excerpt:
            "Precios históricos de BTC desde 2010 hasta 2026. Escenarios de mercado de bitcoin y cotización observada.",
          contentHash: "hash-btc-price-history-public",
          httpStatus: 200,
          bytes: 140,
          retrievedAt: AT,
        }),
      }),
    );
    assert.equal(result.status, "complete");
    const live = useKernel.getState();
    const current = live.goals.find((item) => item.id === goal.id);
    assert.equal(current?.stage, "complete");
    assert.equal(live.evidence.length, 1);
    assert.equal(live.evidence[0]?.url, marketHit.url);
    assert.equal(live.evidence[0]?.validation, "retrieved");
    assert.equal(live.findings.length >= 1, true);
    assert.equal(live.dossiers.length, 1);
  });

  itSerial("completes a full investigation when a provider returns a valid source", async () => {
    const goal = useKernel.getState().createGoal("Taladro 18-25 EUR");
    const result = await runInvestigation(
      goal.id,
      goal.text,
      ioOf({
        search: async () => ({
          ok: true,
          provider: "test",
          hits: [hit({ title: "Taladro 20 EUR", url: "https://example.com/drill" })],
        }),
        read: async ({ data }): Promise<PublicReadResult> => ({
          ok: true,
          url: data.url,
          title: "Taladro 20 EUR",
          sourceHost: "example.com",
          excerpt: "El taladro percutor se ofrece a 20 EUR en la ficha pública de ferretería.",
          contentHash: "hash-drill-20-public-observation",
          httpStatus: 200,
          bytes: 90,
          retrievedAt: AT,
        }),
      }),
    );
    assert.equal(result.status, "complete");
    const live = useKernel.getState();
    assert.equal(live.evidence.length, 1);
    assert.equal(live.findings.length >= 1, true);
    assert.equal(live.dossiers.length, 1);
  });
});
