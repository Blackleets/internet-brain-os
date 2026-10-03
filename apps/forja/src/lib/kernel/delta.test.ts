import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyDelta, tensedMemory } from "./delta.ts";
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

const finding = {
  title: "Taladro de calidad a 20 EUR",
  answer: "Una ficha pública lista un taladro Bosch alrededor de 20 euros.",
};

describe("classifyDelta", () => {
  it("returns nothing when there is no related memory", () => {
    assert.equal(classifyDelta(finding, []), null);
  });

  it("refuses tension against empty memory even if the model claims it", () => {
    assert.equal(
      classifyDelta(finding, [], { kind: "tension", note: "inventado" }),
      null,
    );
  });

  it("marks confirmed on high overlap", () => {
    const result = classifyDelta(finding, [
      { memory, score: 0.55, overlap: 3 },
    ]);
    assert.equal(result?.kind, "confirmed");
    assert.equal(result?.memoryId, "m1");
  });

  it("marks novel on weak related overlap", () => {
    const result = classifyDelta(finding, [
      { memory, score: 0.14, overlap: 1 },
    ]);
    assert.equal(result?.kind, "novel");
  });

  it("accepts an interpreter tension hint only with related memory", () => {
    const result = classifyDelta(
      finding,
      [{ memory, score: 0.4, overlap: 2 }],
      { kind: "tension", note: "El extracto lista 80 EUR, no 20." },
    );
    assert.equal(result?.kind, "tension");
    assert.match(result?.note ?? "", /80 EUR/);
  });

  it("binds tension to the memory named in the note, not just the top score", () => {
    const other: MemoryRecord = {
      ...memory,
      id: "m2",
      title: "Listado descatalogado de Leroy a 80 euros",
      why: "Dato anterior, no contrastado.",
    };
    const result = classifyDelta(
      finding,
      [
        { memory, score: 0.55, overlap: 3 },
        { memory: other, score: 0.2, overlap: 1 },
      ],
      { kind: "tension", note: "El extracto contradice el listado descatalogado de Leroy." },
    );
    assert.equal(result?.kind, "tension");
    assert.equal(result?.memoryId, "m2");
  });
});

describe("tensedMemory", () => {
  const later: Finding = {
    id: "f2",
    goalId: "g2",
    title: "Precio distinto",
    answer: "La ficha lista 80 EUR.",
    whyItMatters: "Contradice el precio admitido.",
    confidence: "medium",
    evidenceIds: ["e2"],
    uncertainties: [],
    nextAction: "Revisar la memoria.",
    interpretationAvailable: true,
    createdAt: memory.admittedAt,
    delta: "tension",
    deltaMemoryId: "m1",
  };

  it("returns the other case's memory while it still exists", () => {
    assert.equal(tensedMemory(later, [memory])?.id, "m1");
  });

  it("is gone after that memory leaves the kernel", () => {
    assert.equal(tensedMemory(later, []), undefined);
  });

  it("ignores tension against the same case", () => {
    const same: Finding = { ...later, goalId: "g1" };
    assert.equal(tensedMemory(same, [memory]), undefined);
  });

  it("ignores findings that are not tension", () => {
    const confirmed: Finding = { ...later, delta: "confirmed" };
    assert.equal(tensedMemory(confirmed, [memory]), undefined);
  });
});
