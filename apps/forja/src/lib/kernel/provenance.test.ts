import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sealCause } from "./dossier.ts";
import {
  closingSeal,
  evidenceForFinding,
  memoryInfluence,
  sourcesForFinding,
  traceFinding,
  traceSeal,
} from "./provenance.ts";
import type { Dossier, Evidence, Finding, MemoryRecord } from "./types.ts";

const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro 20 EUR",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR",
  contentHash: "abc123def4567890abcd",
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
  uncertainties: [],
  nextAction: "",
  interpretationAvailable: true,
  createdAt: evidence.retrievedAt,
  delta: "confirmed",
  deltaMemoryId: "m1",
};

const memory: MemoryRecord = {
  id: "m1",
  findingId: "f0",
  goalId: "g0",
  title: "Taladro Bosch de 20 euros",
  why: "Precio verificado.",
  evidenceIds: ["e0"],
  admittedAt: evidence.retrievedAt,
  lifecycle: "admitted",
  informedGoalIds: ["g1"],
};

const laterMemory: MemoryRecord = {
  ...memory,
  id: "m2",
  title: "Taladro visto después",
  why: "Otra memoria admitida luego.",
};

const dossier: Dossier = {
  id: "d1",
  goalId: "g1",
  sealedAt: evidence.retrievedAt,
  sealHash: "abc123def4567890abcd",
  executive: finding.answer,
  known: [
    {
      memoryId: "m1",
      title: memory.title,
      findingId: memory.findingId,
      goalId: memory.goalId,
      admittedAt: memory.admittedAt,
      lifecycle: "admitted",
      whyHash: "whyhash1234567890abcd",
      consultedAt: evidence.retrievedAt,
    },
  ],
  memoryContextHash: "ctx123def4567890abcd",
  novel: [],
  confirmed: [finding.title],
  tensions: [],
  uncertain: [],
  next: "",
  findingIds: ["f1"],
  evidenceIds: ["e1"],
  evidenceHashes: [evidence.contentHash],
  sourceHosts: ["example.com"],
  interpretationAvailable: true,
  memoryConsulted: 1,
  reusedCount: 0,
};

describe("finding provenance", () => {
  it("binds a finding to its observed sources, not to memory", () => {
    const sources = sourcesForFinding(finding, [evidence]);
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.url, evidence.url);
    assert.equal(sources[0]?.contentHash, evidence.contentHash);
    assert.equal(
      evidenceForFinding(finding, [evidence]).some((item) => item.id === "m1"),
      false,
    );
  });

  it("names the seal that closed the finding", () => {
    const seal = closingSeal(finding, [dossier]);
    assert.equal(seal?.id, "d1");
    const trace = traceFinding(finding, [evidence], [dossier]);
    assert.equal(trace.closedBySealId, "d1");
    assert.equal(trace.influencedByMemoryId, "m1");
    assert.deepEqual(trace.sourceHosts, ["example.com"]);
  });
});

describe("memory influence", () => {
  it("separates consulted, historic and not-consulted memory", () => {
    const related = [
      { memory, score: 0.4, overlap: 2 },
      { memory: laterMemory, score: 0.3, overlap: 2 },
    ];
    const influence = memoryInfluence(dossier, related, [laterMemory]);
    assert.equal(influence.consulted[0]?.memoryId, "m1");
    assert.equal(influence.historic[0]?.memoryId, "m1");
    assert.equal(influence.notConsulted[0]?.id, "m2");
    assert.equal(
      influence.consulted.some((item) => item.memoryId === "m2"),
      false,
    );
  });
});

describe("seal provenance", () => {
  it("classifies S1→S2 as memory when only the consult changed", () => {
    const newer: Dossier = {
      ...dossier,
      id: "d2",
      sealHash: "bbb123def4567890abcd",
      supersedesId: "d1",
      known: [
        {
          memoryId: "m2",
          title: laterMemory.title,
          findingId: laterMemory.findingId,
          goalId: laterMemory.goalId,
          admittedAt: laterMemory.admittedAt,
          lifecycle: "admitted",
          whyHash: "otherwhy1234567890abcd",
          consultedAt: "2026-08-29T02:00:00.000Z",
        },
      ],
      memoryContextHash: "ctx-new-1234567890ab",
    };
    assert.equal(sealCause(newer, dossier), "memory");
    const trace = traceSeal(newer, [evidence], [finding], [laterMemory], [
      { memory: laterMemory, score: 0.4, overlap: 2 },
    ], dossier);
    assert.equal(trace.causeFromPrevious, "memory");
    assert.equal(trace.hashesChanged, false);
    assert.equal(trace.knownChanged, true);
    assert.match(trace.changeNote ?? "", /memoria consultada/);
    assert.equal(trace.supersedesId, "d1");
  });

  it("classifies a later hash change as evidence, not memory", () => {
    const newer: Dossier = {
      ...dossier,
      id: "d3",
      sealHash: "ccc123def4567890abcd",
      supersedesId: "d2",
      evidenceHashes: ["zzz123def4567890abcd"],
      evidenceIds: ["e2"],
    };
    assert.equal(sealCause(newer, dossier), "evidence");
    const trace = traceSeal(newer, [evidence], [finding], [memory], [
      { memory, score: 0.4, overlap: 2 },
    ], dossier);
    assert.equal(trace.causeFromPrevious, "evidence");
    assert.equal(trace.hashesChanged, true);
    assert.equal(trace.knownChanged, false);
  });
});
