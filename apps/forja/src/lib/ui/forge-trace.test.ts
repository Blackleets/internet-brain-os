import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildForgeTrace } from "./forge-trace.ts";

describe("forge trace", () => {
  it("shows derived queries while search is still running, without inventing providers", () => {
    const lines = buildForgeTrace({
      stage: "searching",
      planQueries: ["el salvador bitcoin curso legal", "bitcoin legal tender el salvador"],
    });
    assert.equal(lines[0]?.tone, "live");
    assert.match(lines[0]?.title ?? "", /2 consultas/);
    assert.deepEqual(lines[0]?.items, [
      "el salvador bitcoin curso legal",
      "bitcoin legal tender el salvador",
    ]);
    assert.equal(lines[1]?.phase, "searching");
    assert.equal(lines[1]?.tone, "live");
    assert.doesNotMatch(JSON.stringify(lines), /Wikipedia · 4/);
    assert.doesNotMatch(JSON.stringify(lines), /DATOS OBSERVADOS/);
  });

  it("names real providers after discovery, including failures", () => {
    const lines = buildForgeTrace({
      stage: "reading",
      discovery: {
        queries: ["openAI cotizada"],
        providers: [
          { name: "wikipedia", status: "empty", hitCount: 0 },
          { name: "duckduckgo-lite", status: "ok", hitCount: 8 },
          { name: "hacker-news", status: "fail", hitCount: 0, error: "Hacker News no devolvió URLs." },
        ],
        found: 8,
        usable: 6,
        domains: ["sec.gov", "reuters.com"],
      },
      leads: [{ sourceHost: "sec.gov" }],
      evidence: [{ sourceHost: "sec.gov", title: "Form 10-K" }],
    });
    const search = lines.find((item) => item.id === "search");
    assert.ok(search?.items?.some((row) => /Wikipedia · sin URLs/.test(row)));
    assert.ok(search?.items?.some((row) => /DuckDuckGo · 8 URL/.test(row)));
    assert.ok(search?.items?.some((row) => /Hacker News/.test(row)));
    assert.match(search?.title ?? "", /utilizables 6/);
    const read = lines.find((item) => item.id === "read");
    assert.match(read?.title ?? "", /1 evidencia/);
    assert.ok(read?.items?.some((row) => /sec.gov/.test(row)));
  });

  it("does not treat interpretation as admission", () => {
    const lines = buildForgeTrace({
      stage: "interpreting",
      model: "Grok 4.5",
      evidence: [{ sourceHost: "eur-lex.europa.eu", title: "AI Act" }],
      discovery: {
        queries: ["reglamento ia alto riesgo"],
        providers: [{ name: "google-news", status: "ok", hitCount: 4 }],
        found: 4,
        usable: 3,
        domains: ["eur-lex.europa.eu"],
        extracted: 1,
      },
    });
    const interpret = lines.find((item) => item.id === "interpret");
    assert.equal(interpret?.tone, "live");
    assert.match(interpret?.title ?? "", /Grok 4\.5 interpreta/);
    assert.match(interpret?.detail ?? "", /Kernel sí/);
    assert.equal(lines.some((item) => item.id === "seal"), false);
  });

  it("marks an incomplete investigation as fail, never Completado", () => {
    const lines = buildForgeTrace({
      stage: "blocked",
      planQueries: ["x"],
      blockedReason: "Investigación incompleta. Ningún proveedor devolvió URLs utilizables.",
    });
    const fail = lines.find((item) => item.id === "fail");
    assert.equal(fail?.tone, "fail");
    assert.match(fail?.detail ?? "", /Ningún proveedor/);
    assert.equal(lines.some((item) => item.phase === "completed"), false);
  });
});
