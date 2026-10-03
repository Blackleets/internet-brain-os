import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { admitEvidence, admitFinding, admitMemory, admitDossier, duplicateFinding, refuseEvidenceIdReuse, refuseFindingIdReuse } from "./admission.ts";
import type { Dossier, Evidence, Finding, MemoryRecord } from "./types.ts";


const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR",
  contentHash: "abc123def4567890",
  retrievedAt: "2026-08-29T00:00:00.000Z",
  httpStatus: 200,
  bytes: 12,
  validation: "retrieved",
};

describe("admitEvidence", () => {
  it("rejects http urls", () => {
    const result = admitEvidence({ ...evidence, url: "http://example.com/x" });
    assert.equal(result.ok, false);
  });

  it("rejects empty excerpts", () => {
    const result = admitEvidence({ ...evidence, excerpt: "  " });
    assert.equal(result.ok, false);
  });

  it("admits a retrieved https source", () => {
    const result = admitEvidence(evidence);
    assert.equal(result.ok, true);
  });
});

describe("admitFinding", () => {
  const finding: Finding = {
    id: "f1",
    goalId: "g1",
    title: "Precio",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango.",
    confidence: "medium",
    evidenceIds: ["e1"],
    uncertainties: [],
    nextAction: "Comparar otra fuente",
    interpretationAvailable: true,
    createdAt: evidence.retrievedAt,
  };

  it("blocks findings without evidence", () => {
    const result = admitFinding({ ...finding, evidenceIds: [] }, [evidence]);
    assert.equal(result.ok, false);
  });

  it("blocks findings citing unknown evidence", () => {
    const result = admitFinding({ ...finding, evidenceIds: ["missing"] }, [
      evidence,
    ]);
    assert.equal(result.ok, false);
  });

  it("admits a finding bound to kernel evidence", () => {
    const result = admitFinding(finding, [evidence]);
    assert.equal(result.ok, true);
  });

  it("treats the same title and answer on the same case as a duplicate", () => {
    assert.equal(duplicateFinding([finding], { ...finding, id: "f2" }), true);
  });

  it("allows the same answer on a different case", () => {
    assert.equal(
      duplicateFinding([finding], { ...finding, id: "f2", goalId: "g2" }),
      false,
    );
  });

  it("refuses to reuse a finding id with different content", () => {
    const result = refuseFindingIdReuse([finding], {
      ...finding,
      title: "Otro título",
      answer: "Otra respuesta.",
    });
    assert.equal(result.ok, false);
  });

  it("refuses to reuse an evidence id with different content", () => {
    const result = refuseEvidenceIdReuse([evidence], {
      ...evidence,
      contentHash: "otherhash1234567890ab",
      excerpt: "Otra observación.",
    });
    assert.equal(result.ok, false);
  });
});

describe("admitMemory", () => {
  const finding: Finding = {
    id: "f1",
    goalId: "g1",
    title: "Precio",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango.",
    confidence: "medium",
    evidenceIds: ["e1"],
    uncertainties: [],
    nextAction: "Comparar",
    interpretationAvailable: true,
    createdAt: evidence.retrievedAt,
  };
  const memory: MemoryRecord = {
    id: "m1",
    findingId: "f1",
    goalId: "g1",
    title: "Precio",
    why: "Útil para la próxima compra",
    evidenceIds: ["e1"],
    admittedAt: evidence.retrievedAt,
    lifecycle: "admitted",
    informedGoalIds: [],
  };

  it("does not treat chat as memory", () => {
    const result = admitMemory(memory, undefined);
    assert.equal(result.ok, false);
  });

  it("refuses extra evidence ids", () => {
    const result = admitMemory({ ...memory, evidenceIds: ["e1", "e2"] }, finding);
    assert.equal(result.ok, false);
  });

  it("admits memory from an explicit finding", () => {
    const result = admitMemory(memory, finding);
    assert.equal(result.ok, true);
  });

  it("refuses memory without an operator why", () => {
    const result = admitMemory({ ...memory, why: "  " }, finding);
    assert.equal(result.ok, false);
  });

  it("refuses a why shorter than eight characters", () => {
    const result = admitMemory({ ...memory, why: "porque" }, finding);
    assert.equal(result.ok, false);
  });

  it("refuses a memory record whose id is already an evidence id", () => {
    const result = admitMemory({ ...memory, id: "e1" }, finding);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /memoria no es evidencia/i);
  });
});

describe("memory is not evidence", () => {
  const finding: Finding = {
    id: "f1",
    goalId: "g1",
    title: "Precio",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango.",
    confidence: "medium",
    evidenceIds: ["e1"],
    uncertainties: [],
    nextAction: "Comparar",
    interpretationAvailable: true,
    createdAt: evidence.retrievedAt,
  };
  const memory: MemoryRecord = {
    id: "m1",
    findingId: "f1",
    goalId: "g1",
    title: "Precio",
    why: "Útil para la próxima compra",
    evidenceIds: ["e1"],
    admittedAt: evidence.retrievedAt,
    lifecycle: "admitted",
    informedGoalIds: [],
  };

  it("refuses a memory id as evidence", () => {
    const result = admitEvidence({ ...evidence, id: "m1" }, [memory]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /memoria no es evidencia/i);
  });

  it("refuses a finding that cites memory as a source", () => {
    const result = admitFinding({ ...finding, evidenceIds: ["m1"] }, [evidence], [memory]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /memoria como evidencia/);
  });

  it("refuses a dossier that lists a memory id among evidence ids", () => {
    const dossier: Dossier = {
      id: "d1",
      goalId: "g1",
      sealedAt: evidence.retrievedAt,
      sealHash: "abc123def4567890",
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
      confirmed: [],
      tensions: [],
      uncertain: [],
      next: "",
      findingIds: ["f1"],
      evidenceIds: ["e1", "m1"],
      evidenceHashes: [evidence.contentHash],
      sourceHosts: ["example.com"],
      interpretationAvailable: true,
      memoryConsulted: 1,
      reusedCount: 0,
    };
    const result = admitDossier(dossier, [finding], [evidence], [memory], "Taladro 18-25 euros");
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /memoria consultada como evidencia/);
  });
});
