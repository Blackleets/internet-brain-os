import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCaseView, findingIsUnverifiedLead } from "./case-view.ts";
import type { Evidence, Finding, Goal } from "../kernel/types.ts";

function goal(over: Partial<Goal> = {}): Goal {
  return {
    id: "g1",
    text: "¿OpenAI cotiza en bolsa?",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    stage: "complete",
    evidenceIds: [],
    findingIds: [],
    leadCount: 0,
    leads: [],
    watched: false,
    ...over,
  };
}

describe("case view", () => {
  it("does not invent a conclusion when the Kernel has none", () => {
    const view = buildCaseView({
      goal: goal({ status: "failed", stage: "failed", blockedReason: "Ningún proveedor devolvió URLs utilizables." }),
      findings: [],
      evidence: [],
      contradictions: [],
      confidence: [],
    });
    assert.equal(view.conclusion, null);
    assert.equal(view.confidence, null);
    assert.equal(view.incomplete, true);
    assert.match(view.why ?? "", /Ningún proveedor/);
    assert.equal(view.evidenceCount, 0);
  });

  it("uses the sealed executive as the conclusion, not a chatbot paragraph", () => {
    const finding = {
      id: "f1",
      goalId: "g1",
      title: "OpenAI no cotiza",
      answer: "INTERPRETADO: No hay ficha bursátil.",
      whyItMatters: "Cambia el tipo de empresa.",
      nextAction: "Nada",
      evidenceIds: ["e1"],
      interpretationAvailable: true,
      confidence: "medium",
      uncertainties: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    } as Finding;
    const evidence = {
      id: "e1",
      goalId: "g1",
      url: "https://sec.gov/x",
      title: "SEC",
      excerpt: "No registration found.",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      sourceHost: "sec.gov",
      validation: "retrieved",
      contentHash: "abc",
      httpStatus: 200,
      bytes: 1200,
    } as Evidence;
    const view = buildCaseView({
      goal: goal(),
      findings: [finding],
      evidence: [evidence],
      contradictions: [],
      confidence: [],
      dossier: {
        id: "d1",
        goalId: "g1",
        sealedAt: "2026-01-01T01:00:00.000Z",
        sealHash: "hash-1",
        executive: "OpenAI no aparece como empresa cotizada en las fuentes retenidas.",
        known: [],
        memoryContextHash: "m",
        novel: [],
        confirmed: [],
        tensions: [],
        uncertain: [],
        next: "",
        findingIds: ["f1"],
        evidenceIds: ["e1"],
        evidenceHashes: ["abc"],
        sourceHosts: ["sec.gov"],
        interpretationAvailable: true,
        memoryConsulted: 0,
        reusedCount: 0,
      },
    });
    assert.match(view.conclusion ?? "", /no aparece como empresa cotizada/);
    assert.equal(view.statusLabel, "Sellado");
    assert.deepEqual(view.sourceHosts, ["sec.gov"]);
    assert.equal(view.sealHash, "hash-1");
    assert.equal(view.incomplete, false);
  });

  it("labels a finding without retained evidence as an unverified lead", () => {
    assert.equal(
      findingIsUnverifiedLead({ evidenceIds: [], interpretationAvailable: false }),
      true,
    );
    assert.equal(
      findingIsUnverifiedLead({ evidenceIds: ["e1"], interpretationAvailable: true }),
      false,
    );
  });
});
