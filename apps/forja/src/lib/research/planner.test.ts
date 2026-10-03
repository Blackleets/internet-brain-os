import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planResearch, urlsMentioned } from "./planner.ts";

describe("planResearch", () => {
  it("strips instructional Spanish and keeps the searchable core", () => {
    const plan = planResearch(
      "busca los precios de BTC desde 2010 hasta 2026 y calcula si subirá o no",
    );
    assert.equal(plan.lang, "es");
    assert.match(plan.webQuery, /btc/);
    assert.match(plan.webQuery, /2010/);
    assert.equal(/busca|calcula|\bsi\b|\bno\b|desde|hasta/.test(plan.webQuery), false);
    assert.equal(plan.entityQuery.includes("btc"), true);
    assert.equal(plan.wantsStructured, true);
    assert.equal(plan.queries.length >= 1, true);
  });

  it("does not invent a ticker expansion", () => {
    const plan = planResearch("busca los precios de BTC desde 2010 hasta 2026 y calcula si subirá o no");
    assert.equal(/bitcoin/i.test(plan.webQuery), false);
    assert.equal(/bitcoin/i.test(plan.entityQuery), false);
  });

  it("keeps an encyclopedia question as the topic token", () => {
    const plan = planResearch("qué es Wikipedia");
    assert.equal(plan.webQuery, "wikipedia");
    assert.equal(plan.entityQuery, "wikipedia");
    assert.equal(plan.wantsStructured, false);
  });

  it("extracts explicit https URLs from the goal", () => {
    assert.deepEqual(urlsMentioned("Lee https://example.com/a y https://iana.org/b."), [
      "https://example.com/a",
      "https://iana.org/b",
    ]);
  });
});
