import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { relatedMemory, tokenize } from "./related-memory.ts";
import type { Finding, MemoryRecord } from "./types.ts";

const memory: MemoryRecord = {
  id: "m1",
  findingId: "f1",
  goalId: "g1",
  title: "Taladro Bosch de 20 euros",
  why: "Precio verificado en una ficha pública.",
  evidenceIds: ["e1"],
  admittedAt: "2026-08-29T00:00:00.000Z",
  lifecycle: "admitted",
  informedGoalIds: [],
};

const finding: Finding = {
  id: "f1",
  goalId: "g1",
  title: "Taladro de calidad a 20 EUR",
  answer: "Una ficha pública lista un taladro Bosch alrededor de 20 euros.",
  whyItMatters: "El precio estaba en el extracto.",
  confidence: "medium",
  evidenceIds: ["e1"],
  uncertainties: [],
  nextAction: "Comprobar disponibilidad.",
  interpretationAvailable: true,
  createdAt: "2026-08-29T00:00:00.000Z",
};

describe("tokenize", () => {
  it("drops spanish stopwords and diacritics", () => {
    const tokens = tokenize("Qué es el taladro de calidad");
    assert.deepEqual(tokens, ["taladro", "calidad"]);
  });
});

describe("relatedMemory", () => {
  it("returns nothing without overlap", () => {
    const hits = relatedMemory("ofertas de trabajo freelance en diseño", [memory], [finding]);
    assert.equal(hits.length, 0);
  });

  it("matches a later goal to admitted memory", () => {
    const hits = relatedMemory(
      "Encuentra un taladro de calidad entre 18 y 25 euros",
      [memory],
      [finding],
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0].memory.id, "m1");
    assert.ok(hits[0].score >= 0.12);
  });

  it("does not treat memory as present when the kernel is empty", () => {
    const hits = relatedMemory("taladro bosch", [], []);
    assert.equal(hits.length, 0);
  });

  it("does not confirm a case against its own admitted memory", () => {
    const hits = relatedMemory(
      "Encuentra un taladro de calidad entre 18 y 25 euros",
      [memory],
      [finding],
      "g1",
    );
    assert.equal(hits.length, 0);
  });
});
