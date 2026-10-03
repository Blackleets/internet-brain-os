import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyContradictions,
  contradictionKey,
  contradictionLabel,
  mergeContradictions,
  openContradictions,
  polesAreValid,
} from "./contradiction.ts";
import type { Dossier, Evidence, Finding, MemoryRecord } from "./types.ts";

const AT = "2026-08-29T00:00:00.000Z";

const e1: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro 20 EUR",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR",
  contentHash: "abc123def4567890abcd",
  retrievedAt: AT,
  httpStatus: 200,
  bytes: 12,
  validation: "retrieved",
};

const e2: Evidence = {
  ...e1,
  id: "e2",
  title: "Taladro 22 EUR",
  excerpt: "Taladro 22 EUR",
  contentHash: "zzz123def4567890abcd",
  retrievedAt: "2026-08-29T08:00:00.000Z",
};

const eNewUrl: Evidence = {
  ...e1,
  id: "e3",
  url: "https://example.org/other-drill",
  sourceHost: "example.org",
  title: "Otra ficha",
  contentHash: "otherhash1234567890ab",
  retrievedAt: "2026-08-29T03:00:00.000Z",
};

const memory: MemoryRecord = {
  id: "m1",
  findingId: "f0",
  goalId: "g0",
  title: "Taladro Bosch de 20 euros",
  why: "Precio verificado en una ficha pública.",
  evidenceIds: ["e0"],
  admittedAt: AT,
  lifecycle: "admitted",
  informedGoalIds: ["g1"],
};

const laterMemory: MemoryRecord = {
  ...memory,
  id: "m2",
  findingId: "f2",
  goalId: "g1",
  title: "La ficha lista 22 EUR",
  why: "Observación posterior admitida.",
  evidenceIds: ["e2"],
  admittedAt: "2026-08-29T09:00:00.000Z",
};

const tensedFinding: Finding = {
  id: "f2",
  goalId: "g1",
  title: "Precio distinto",
  answer: "La ficha lista 22 EUR.",
  whyItMatters: "Contradice el precio admitido.",
  confidence: "medium",
  evidenceIds: ["e2"],
  uncertainties: [],
  nextAction: "Revisar la memoria.",
  interpretationAvailable: true,
  createdAt: e2.retrievedAt,
  delta: "tension",
  deltaNote: "El extracto lista 22 EUR, no 20.",
  deltaMemoryId: "m1",
};

function dossierStub(over: Partial<Dossier> = {}): Dossier {
  return {
    id: "d1",
    goalId: "g1",
    sealedAt: AT,
    sealHash: "abc123def4567890abcd",
    executive: "Hay un taladro a 20 EUR.",
    known: [],
    memoryContextHash: "",
    novel: [],
    confirmed: [],
    tensions: [],
    uncertain: [],
    next: "",
    findingIds: ["f1"],
    evidenceIds: ["e1"],
    evidenceHashes: [e1.contentHash],
    sourceHosts: ["example.com"],
    interpretationAvailable: true,
    memoryConsulted: 0,
    reusedCount: 0,
    ...over,
  };
}

describe("evidence against evidence", () => {
  it("classifies two hashes of the same url as evidence-evidence", () => {
    const rows = classifyContradictions({
      evidence: [e1, e2],
      findings: [],
      memory: [],
      dossiers: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.kind, "evidence-evidence");
    assert.equal(rows[0]?.left.kind, "evidence");
    assert.equal(rows[0]?.right.kind, "evidence");
    assert.equal(rows[0]?.left.fingerprint, e1.contentHash);
    assert.equal(rows[0]?.right.fingerprint, e2.contentHash);
    assert.match(rows[0]?.note ?? "", /huella/);
    assert.equal(rows[0]?.note.includes("memoria"), false);
  });

  it("does not treat a new url as evidence-evidence", () => {
    const rows = classifyContradictions({
      evidence: [e1, eNewUrl],
      findings: [],
      memory: [],
      dossiers: [],
    });
    assert.equal(rows.some((item) => item.kind === "evidence-evidence"), false);
  });
});

describe("evidence against memory", () => {
  it("binds a tensed finding to evidence and memory poles, never the reverse", () => {
    const rows = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [memory],
      dossiers: [],
    });
    const hit = rows.find((item) => item.kind === "evidence-memory");
    assert.ok(hit);
    assert.equal(hit.left.kind, "evidence");
    assert.equal(hit.right.kind, "memory");
    assert.equal(hit.right.id, "m1");
    assert.equal(hit.left.id, "e2");
    assert.equal(hit.open, true);
    assert.equal(polesAreValid(hit), true);
  });
});

describe("memory against memory", () => {
  it("appears only after the tensed finding is itself admitted to memory", () => {
    const before = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [memory],
      dossiers: [],
    });
    assert.equal(before.some((item) => item.kind === "memory-memory"), false);

    const after = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [memory, laterMemory],
      dossiers: [],
    });
    const hit = after.find((item) => item.kind === "memory-memory");
    assert.ok(hit);
    assert.equal(hit.left.kind, "memory");
    assert.equal(hit.right.kind, "memory");
    const ids = [hit.left.id, hit.right.id].sort();
    assert.deepEqual(ids, ["m1", "m2"]);
    assert.equal(hit.open, true);
    assert.match(hit.note, /Dos memorias admitidas/);
  });

  it("stays historic when the tensed memory leaves the live kernel", () => {
    const snap = dossierStub({
      known: [
        {
          memoryId: "m1",
          title: memory.title,
          findingId: memory.findingId,
          goalId: memory.goalId,
          admittedAt: memory.admittedAt,
          lifecycle: "admitted",
          whyHash: "whyhash1234567890abcd",
          consultedAt: AT,
        },
      ],
      memoryContextHash: "ctx123def4567890abcd",
      memoryConsulted: 1,
    });
    const rows = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [laterMemory],
      dossiers: [snap],
    });
    const hit = rows.find((item) => item.kind === "memory-memory");
    assert.ok(hit);
    assert.equal(hit.open, false);
    assert.equal(hit.right.id, "m1");
    assert.equal(hit.right.label, memory.title);
    const live = rows.find((item) => item.kind === "evidence-memory");
    assert.equal(live?.open, false);
  });
});

describe("interpretation against interpretation", () => {
  it("classifies same hashes and different memory as interpretation, never evidence", () => {
    const s1 = dossierStub({
      id: "d1",
      sealHash: "aaa123def4567890abcd",
      memoryContextHash: "ctx-old-1234567890ab",
      known: [
        {
          memoryId: "m1",
          title: memory.title,
          findingId: "f0",
          goalId: "g0",
          admittedAt: AT,
          lifecycle: "admitted",
          whyHash: "whyhash1234567890abcd",
          consultedAt: AT,
        },
      ],
    });
    const s2 = dossierStub({
      id: "d2",
      sealHash: "bbb123def4567890abcd",
      supersedesId: "d1",
      memoryContextHash: "ctx-new-1234567890ab",
      executive: "Con memoria vigente el precio se lee distinto.",
      known: [
        {
          memoryId: "m2",
          title: laterMemory.title,
          findingId: "f2",
          goalId: "g1",
          admittedAt: laterMemory.admittedAt,
          lifecycle: "admitted",
          whyHash: "otherwhy1234567890abcd",
          consultedAt: "2026-08-29T09:00:00.000Z",
        },
      ],
    });
    const rows = classifyContradictions({
      evidence: [e1],
      findings: [],
      memory: [laterMemory],
      dossiers: [s2, s1],
    });
    assert.equal(rows.some((item) => item.kind === "evidence-evidence"), false);
    const hit = rows.find((item) => item.kind === "interpretation-interpretation");
    assert.ok(hit);
    assert.equal(hit.left.kind, "seal");
    assert.equal(hit.right.kind, "seal");
    assert.match(hit.note, /memoria consultada/);
    assert.equal(hit.note.includes("fuente"), false);
    assert.equal(hit.note.includes("huella"), false);
    assert.equal(hit.open, false);
  });

  it("does not emit interpretation when only evidence hashes changed", () => {
    const s1 = dossierStub({ id: "d1", sealHash: "aaa123def4567890abcd" });
    const s2 = dossierStub({
      id: "d2",
      sealHash: "ccc123def4567890abcd",
      supersedesId: "d1",
      evidenceHashes: [e2.contentHash],
      evidenceIds: ["e2"],
    });
    const rows = classifyContradictions({
      evidence: [e1, e2],
      findings: [],
      memory: [],
      dossiers: [s2, s1],
    });
    assert.equal(rows.some((item) => item.kind === "interpretation-interpretation"), false);
    assert.equal(rows.some((item) => item.kind === "evidence-evidence"), true);
  });

  it("emits both kinds when hashes and memory changed, without mixing notes", () => {
    const s1 = dossierStub({
      id: "d1",
      sealHash: "aaa123def4567890abcd",
      memoryContextHash: "ctx-old-1234567890ab",
      known: [
        {
          memoryId: "m1",
          title: memory.title,
          findingId: "f0",
          goalId: "g0",
          admittedAt: AT,
          lifecycle: "admitted",
          whyHash: "whyhash1234567890abcd",
          consultedAt: AT,
        },
      ],
    });
    const s2 = dossierStub({
      id: "d2",
      sealHash: "ddd123def4567890abcd",
      supersedesId: "d1",
      evidenceHashes: [e2.contentHash],
      evidenceIds: ["e2"],
      memoryContextHash: "ctx-new-1234567890ab",
      known: [
        {
          memoryId: "m2",
          title: laterMemory.title,
          findingId: "f2",
          goalId: "g1",
          admittedAt: laterMemory.admittedAt,
          lifecycle: "admitted",
          whyHash: "otherwhy1234567890abcd",
          consultedAt: "2026-08-29T09:00:00.000Z",
        },
      ],
    });
    const rows = classifyContradictions({
      evidence: [e1, e2],
      findings: [],
      memory: [laterMemory],
      dossiers: [s2, s1],
    });
    const interpretation = rows.find((item) => item.kind === "interpretation-interpretation");
    const evidence = rows.find((item) => item.kind === "evidence-evidence");
    assert.ok(interpretation);
    assert.ok(evidence);
    assert.match(interpretation.note, /memoria consultada/);
    assert.equal(interpretation.note.includes("huella"), false);
    assert.match(evidence.note, /huella/);
    assert.equal(evidence.note.includes("memoria"), false);
  });
});

describe("mergeContradictions", () => {
  it("keeps identity and marks a vanished memory contradiction historic", () => {
    const derived = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [memory, laterMemory],
      dossiers: [],
    });
    const first = mergeContradictions([], derived, {
      now: AT,
      nextId: () => "x1",
    });
    const mm = first.find((item) => item.kind === "memory-memory");
    assert.ok(mm);
    const afterForget = classifyContradictions({
      evidence: [e2],
      findings: [tensedFinding],
      memory: [laterMemory],
      dossiers: [
        dossierStub({
          known: [
            {
              memoryId: "m1",
              title: memory.title,
              findingId: memory.findingId,
              goalId: memory.goalId,
              admittedAt: memory.admittedAt,
              lifecycle: "admitted",
              whyHash: "whyhash1234567890abcd",
              consultedAt: AT,
            },
          ],
        }),
      ],
    });
    const merged = mergeContradictions(first, afterForget, {
      now: "2026-08-29T10:00:00.000Z",
      nextId: () => "x2",
    });
    const kept = merged.find((item) => item.kind === "memory-memory");
    assert.equal(kept?.id, mm.id);
    assert.equal(kept?.at, AT);
    assert.equal(kept?.open, false);
    assert.equal(kept?.closedAt, "2026-08-29T10:00:00.000Z");
    assert.equal(contradictionKey(kept!), contradictionKey(mm));
  });
});

describe("labels", () => {
  it("names the four kinds without collapsing them", () => {
    assert.equal(contradictionLabel("evidence-evidence"), "Evidencia contra evidencia");
    assert.equal(contradictionLabel("memory-memory"), "Memoria contra memoria");
    assert.equal(contradictionLabel("evidence-memory"), "Evidencia contra memoria");
    assert.equal(contradictionLabel("interpretation-interpretation"), "Interpretación distinta");
    const closed = classifyContradictions({
      evidence: [e1, e2],
      findings: [tensedFinding],
      memory: [memory, laterMemory],
      dossiers: [
        dossierStub({
          id: "d2",
          supersedesId: "d1",
          sealHash: "bbb123def4567890abcd",
          memoryContextHash: "ctx-new-1234567890ab",
          known: [
            {
              memoryId: "m2",
              title: laterMemory.title,
              findingId: "f2",
              goalId: "g1",
              admittedAt: laterMemory.admittedAt,
              lifecycle: "admitted",
              whyHash: "otherwhy1234567890abcd",
              consultedAt: laterMemory.admittedAt,
            },
          ],
        }),
        dossierStub({
          id: "d1",
          memoryContextHash: "ctx-old-1234567890ab",
          known: [
            {
              memoryId: "m1",
              title: memory.title,
              findingId: "f0",
              goalId: "g0",
              admittedAt: AT,
              lifecycle: "admitted",
              whyHash: "whyhash1234567890abcd",
              consultedAt: AT,
            },
          ],
        }),
      ],
    });
    const kinds = new Set(closed.map((item) => item.kind));
    assert.equal(kinds.has("evidence-evidence"), true);
    assert.equal(kinds.has("evidence-memory"), true);
    assert.equal(kinds.has("memory-memory"), true);
    assert.equal(kinds.has("interpretation-interpretation"), true);
    assert.equal(openContradictions(mergeContradictions([], closed, { now: AT, nextId: () => "x" })).every((item) => item.open), true);
  });
});
