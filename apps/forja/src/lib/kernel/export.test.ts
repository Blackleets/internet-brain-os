import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findingToMarkdown, parseKernelSnapshot, slugFile } from "./export.ts";
import type { Evidence, Finding, Goal } from "./types.ts";

const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro 20 EUR",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR",
  contentHash: "abc123def4567890",
  retrievedAt: "2026-08-29T00:00:00.000Z",
  httpStatus: 200,
  bytes: 12,
  validation: "retrieved",
};

const finding: Finding = {
  id: "f1",
  goalId: "g1",
  title: "Precio observado",
  answer: "Hay un taladro a 20 EUR.",
  whyItMatters: "Encaja en el rango.",
  confidence: "medium",
  evidenceIds: ["e1"],
  uncertainties: ["Una sola fuente"],
  nextAction: "Comparar otra tienda",
  interpretationAvailable: true,
  createdAt: evidence.retrievedAt,
};

const goal: Goal = {
  id: "g1",
  text: "Taladro 18-25 euros",
  createdAt: evidence.retrievedAt,
  updatedAt: evidence.retrievedAt,
  status: "complete",
  stage: "complete",
  evidenceIds: ["e1"],
  findingIds: ["f1"],
  leadCount: 1,
  leads: [],
  watched: false,
};

describe("findingToMarkdown", () => {
  it("includes evidence url and hash, never invents sources", () => {
    const md = findingToMarkdown(finding, [evidence], goal);
    assert.match(md, /Precio observado/);
    assert.match(md, /https:\/\/example.com\/drill/);
    assert.match(md, /abc123def4567890/);
    assert.match(md, /Taladro 18-25 euros/);
    assert.doesNotMatch(md, /sparkle|✨/i);
  });

  it("omits unlinked evidence", () => {
    const md = findingToMarkdown({ ...finding, evidenceIds: ["missing"] }, [
      evidence,
    ]);
    assert.match(md, /sin fuentes vinculadas/);
    assert.doesNotMatch(md, /example.com\/drill/);
  });
});

describe("slugFile", () => {
  it("strips accents for filenames", () => {
    assert.equal(slugFile("Hallazgo útil"), "hallazgo-util");
  });
});

describe("parseKernelSnapshot", () => {
  it("rejects garbage and foreign products", () => {
    assert.equal(parseKernelSnapshot("nope").ok, false);
    assert.equal(parseKernelSnapshot("[]").ok, false);
    assert.equal(parseKernelSnapshot(JSON.stringify({ product: "ChatGPT", goals: [] })).ok, false);
    assert.equal(parseKernelSnapshot(JSON.stringify({ product: "Efesto", goals: {} })).ok, false);
  });

  it("accepts an Efesto export", () => {
    const parsed = parseKernelSnapshot(
      JSON.stringify({
        product: "Efesto",
        exportedAt: "2026-08-30T00:00:00.000Z",
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
      }),
    );
    assert.equal(parsed.ok, true);
  });
});

