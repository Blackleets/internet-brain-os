import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractFromMediaWikiPages,
  hitsFromDuckInstantAnswer,
  hitsFromHnAlgolia,
  hitsFromMediaWikiSearch,
  mergeHits,
  rankHits,
  researchQueryPlan,
  wikiTitleUrl,
  wikipediaPageFromUrl,
} from "./search-parse.ts";

describe("wikipedia full-text parse", () => {
  it("builds public https article URLs from MediaWiki search", () => {
    const hits = hitsFromMediaWikiSearch("es", {
      query: {
        search: [
          {
            title: "Wikipedia en español",
            snippet: "La <span class=\"searchmatch\">Wikipedia</span> en español",
          },
        ],
      },
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].url.startsWith("https://es.wikipedia.org/wiki/"), true);
    assert.equal(hits[0].title, "Wikipedia en español");
    assert.equal(hits[0].snippet.includes("<span"), false);
    assert.equal(wikiTitleUrl("en", "OpenAI"), "https://en.wikipedia.org/wiki/OpenAI");
  });

  it("does not invent hits from an empty opensearch-shaped payload", () => {
    assert.deepEqual(hitsFromMediaWikiSearch("es", ["qué es Wikipedia", [], [], []]), []);
  });
});

describe("hacker news parse", () => {
  it("keeps only https story URLs", () => {
    const hits = hitsFromHnAlgolia({
      hits: [
        { title: "HTTP skip", url: "http://example.com/a" },
        { title: "OpenAI launch", url: "https://openai.com/blog" },
        { title: "no url" },
      ],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].url, "https://openai.com/blog");
  });
});

describe("duck instant answer", () => {
  it("keeps AbstractURL and OfficialWebsite, skips duckduckgo wrappers", () => {
    const hits = hitsFromDuckInstantAnswer({
      Heading: "Bitcoin",
      AbstractText: "Bitcoin is a cryptocurrency.",
      AbstractURL: "https://en.wikipedia.org/wiki/Bitcoin",
      OfficialWebsite: "https://bitcoin.org",
      RelatedTopics: [{ FirstURL: "https://duckduckgo.com/c/Bitcoin", Text: "Category" }],
    });
    assert.equal(hits.some((item) => item.url === "https://en.wikipedia.org/wiki/Bitcoin"), true);
    assert.equal(hits.some((item) => item.url === "https://bitcoin.org/" || item.url === "https://bitcoin.org"), true);
    assert.equal(hits.some((item) => item.sourceHost.includes("duckduckgo")), false);
  });
});

describe("mergeHits", () => {
  it("dedupes by URL", () => {
    const merged = mergeHits([
      [{ title: "A", url: "https://a.example/x", snippet: "", sourceHost: "a.example" }],
      [{ title: "A2", url: "https://a.example/x/", snippet: "", sourceHost: "a.example" }],
    ]);
    assert.equal(merged.length, 1);
  });
});

describe("research query ranking", () => {
  it("normalizes a Spanish question to the topic token", () => {
    const plan = researchQueryPlan("qué es Wikipedia");
    assert.equal(plan.lang, "es");
    assert.equal(plan.core, "wikipedia");
    assert.deepEqual(plan.tokens, ["wikipedia"]);
  });

  it("ranks the Wikipedia article above a coincidental phrase match", () => {
    const ranked = rankHits(
      [
        {
          title: "¡Ay qué rechula es Puebla!",
          url: "https://en.wikipedia.org/wiki/%C2%A1Ay_qu%C3%A9_rechula_es_Puebla!",
          snippet: "A 1946 Mexican film. ¿Qué es la trama?",
          sourceHost: "en.wikipedia.org",
        },
        {
          title: "Wikipedia en español",
          url: "https://es.wikipedia.org/wiki/Wikipedia_en_espa%C3%B1ol",
          snippet: "La Wikipedia en español es la edición en español de Wikipedia.",
          sourceHost: "es.wikipedia.org",
        },
        {
          title: "Wikipedia",
          url: "https://es.wikipedia.org/wiki/Wikipedia",
          snippet: "Wikipedia es una enciclopedia libre.",
          sourceHost: "es.wikipedia.org",
        },
      ],
      "qué es Wikipedia",
    );
    assert.equal(ranked[0]?.title, "Wikipedia");
    assert.equal(ranked[0]?.url, "https://es.wikipedia.org/wiki/Wikipedia");
    assert.equal(
      ranked.some((hit) => /puebla/i.test(hit.title)),
      false,
    );
  });

  it("drops a Wikipedia page that only matches in the snippet", () => {
    const ranked = rankHits(
      [
        {
          title: "¡Ay qué rechula es Puebla!",
          url: "https://en.wikipedia.org/wiki/%C2%A1Ay_qu%C3%A9_rechula_es_Puebla!",
          snippet:
            "Mexican film (1946). The article mentions Wikipedia as a source for the plot.",
          sourceHost: "en.wikipedia.org",
        },
        {
          title: "Wikipedia",
          url: "https://es.wikipedia.org/wiki/Wikipedia",
          snippet: "Wikipedia es una enciclopedia libre.",
          sourceHost: "es.wikipedia.org",
        },
        {
          title: "Show HN: a wiki tool",
          url: "https://example.net/wiki-tool",
          snippet: "A tool that is not Wikipedia.",
          sourceHost: "example.net",
        },
      ],
      "qué es Wikipedia",
    );
    assert.equal(ranked[0]?.title, "Wikipedia");
    assert.equal(
      ranked.some((hit) => /puebla/i.test(hit.title)),
      false,
    );
    assert.equal(
      ranked.some((hit) => hit.sourceHost === "example.net"),
      true,
    );
  });

  it("skips Wikipedia special namespaces in search hits", () => {
    const hits = hitsFromMediaWikiSearch("es", {
      query: {
        search: [
          { title: "Wikipedia", snippet: "enciclopedia" },
          { title: "Especial:Buscar", snippet: "wikipedia" },
          { title: "Wikipedia:Café", snippet: "wikipedia" },
        ],
      },
    });
    assert.deepEqual(
      hits.map((hit) => hit.title),
      ["Wikipedia"],
    );
  });

  it("parses a Wikipedia article URL and skips special namespaces", () => {
    assert.deepEqual(wikipediaPageFromUrl("https://es.wikipedia.org/wiki/Wikipedia"), {
      lang: "es",
      title: "Wikipedia",
    });
    assert.equal(wikipediaPageFromUrl("https://es.wikipedia.org/wiki/Special:Search"), null);
    assert.equal(wikipediaPageFromUrl("https://example.com/wiki/Wikipedia"), null);
  });

  it("reads plaintext extracts without inventing pages", () => {
    const extracted = extractFromMediaWikiPages({
      query: {
        pages: {
          "1": { title: "Wikipedia", extract: "Wikipedia es una enciclopedia libre multilingüe." },
        },
      },
    });
    assert.equal(extracted?.title, "Wikipedia");
    assert.match(extracted?.extract ?? "", /enciclopedia/);
    assert.equal(extractFromMediaWikiPages({ query: { pages: { "-1": { missing: "" } } } }), null);
  });
});
