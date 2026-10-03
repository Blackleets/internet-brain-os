import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  admittedMemory,
  allocateMemoryId,
  buildProposedMemory,
  canTransition,
  explainMemory,
  isLiveMemory,
  liveMemory,
  memoryLineage,
  proposeDecision,
  sealsUsingMemory,
  transitionMemory,
} from "./authority.ts";
import { classifyContradictions } from "./contradiction.ts";
import { composeDossier } from "./dossier.ts";
import type { Evidence, Finding, MemoryRecord } from "./types.ts";

const AT = "2026-08-29T00:00:00.000Z";

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
  createdAt: AT,
};

const evidence: Evidence = {
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

function proposed(over: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: "m1",
    findingId: finding.id,
    goalId: finding.goalId,
    title: finding.title,
    why: "Lo guardo para el siguiente caso.",
    evidenceIds: finding.evidenceIds,
    proposedAt: AT,
    admittedAt: "",
    lifecycle: "proposed",
    informedGoalIds: [],
    ...over,
  };
}

describe("Memory Authority transitions", () => {
  it("1. allows proposed → admitted and records provenance", () => {
    const record = proposed();
    const birth = proposeDecision(record, { at: AT, decisionId: "d0" });
    assert.equal(birth.from, null);
    assert.equal(birth.to, "proposed");
    assert.equal(birth.actor, "kernel");
    const gate = transitionMemory(record, "admitted", {
      at: "2026-08-29T01:00:00.000Z",
      why: "Lo guardo para el siguiente caso.",
      actor: "operator",
      policy: "operator-admission",
      decisionId: "d1",
    });
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.equal(gate.value.record.lifecycle, "admitted");
    assert.equal(gate.value.record.admittedAt, "2026-08-29T01:00:00.000Z");
    assert.equal(gate.value.decision.from, "proposed");
    assert.equal(gate.value.decision.to, "admitted");
    assert.equal(gate.value.decision.actor, "operator");
    assert.equal(gate.value.decision.policy, "operator-admission");
    assert.equal(gate.value.decision.why, "Lo guardo para el siguiente caso.");
    assert.deepEqual(gate.value.decision.evidenceIds, ["e1"]);
  });

  it("2. allows admitted → revoked without deleting the record", () => {
    const admitted = proposed({ lifecycle: "admitted", admittedAt: AT });
    const gate = transitionMemory(admitted, "revoked", {
      at: "2026-08-29T02:00:00.000Z",
      why: "Ya no es vigente.",
      actor: "operator",
      policy: "operator-revoke",
      decisionId: "d2",
    });
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    assert.equal(gate.value.record.id, "m1");
    assert.equal(gate.value.record.lifecycle, "revoked");
    assert.equal(gate.value.record.closedAt, "2026-08-29T02:00:00.000Z");
    assert.equal(isLiveMemory(gate.value.record), false);
    assert.equal(liveMemory([gate.value.record]).length, 0);
  });

  it("3/9. allows admitted → superseded and keeps M1 → M2", () => {
    const m1 = proposed({ lifecycle: "admitted", admittedAt: AT });
    const m2 = proposed({
      id: "m2",
      findingId: "f2",
      lifecycle: "admitted",
      admittedAt: "2026-08-29T03:00:00.000Z",
      supersedesId: "m1",
      title: "Precio distinto",
    });
    const gate = transitionMemory(m1, "superseded", {
      at: "2026-08-29T03:00:00.000Z",
      why: "Sustituida por evidencia posterior.",
      actor: "operator",
      policy: "supersede-tensed",
      decisionId: "d3",
      relatedMemoryId: "m2",
    });
    assert.equal(gate.ok, true);
    if (!gate.ok) return;
    const closed = { ...gate.value.record };
    const chain = memoryLineage([closed, m2], "m1");
    assert.deepEqual(
      chain.map((item) => item.id),
      ["m1", "m2"],
    );
    assert.equal(closed.supersededById, "m2");
    assert.equal(m2.supersedesId, "m1");
    assert.equal(m2.id === "m1", false);
  });

  it("refuses to revive a revoked memory", () => {
    const revoked = proposed({ lifecycle: "revoked", admittedAt: AT, closedAt: AT });
    const gate = transitionMemory(revoked, "admitted", {
      at: "2026-08-29T04:00:00.000Z",
      why: "No.",
      actor: "operator",
      policy: "operator-admission",
      decisionId: "d4",
    });
    assert.equal(gate.ok, false);
    assert.equal(canTransition("revoked", "admitted"), false);
    assert.equal(canTransition("superseded", "admitted"), false);
    assert.equal(canTransition("rejected", "admitted"), false);
  });

  it("allows proposed → quarantined → admitted and proposed → rejected", () => {
    const record = proposed();
    const quarantined = transitionMemory(record, "quarantined", {
      at: "2026-08-29T01:30:00.000Z",
      why: "Hay tensión abierta.",
      actor: "operator",
      policy: "operator-quarantine",
      decisionId: "d5",
    });
    assert.equal(quarantined.ok, true);
    if (!quarantined.ok) return;
    assert.equal(isLiveMemory(quarantined.value.record), true);
    assert.equal(admittedMemory([quarantined.value.record]).length, 0);
    const admitted = transitionMemory(quarantined.value.record, "admitted", {
      at: "2026-08-29T01:45:00.000Z",
      why: "El operador confirma la admisión.",
      actor: "operator",
      policy: "operator-admission",
      decisionId: "d6",
    });
    assert.equal(admitted.ok, true);
    const rejected = transitionMemory(proposed({ id: "m9" }), "rejected", {
      at: AT,
      why: "La puerta de admisión no se cumple.",
      actor: "kernel",
      policy: "admission-gate",
      decisionId: "d7",
    });
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    assert.equal(rejected.value.record.lifecycle, "rejected");
    assert.equal(isLiveMemory(rejected.value.record), false);
  });

  it("4/5. reconstructs proposed → admitted → revoked from kernel decisions", () => {
    const record = proposed();
    const birth = proposeDecision(record, { at: AT, decisionId: "d0", why: "Propuesta a partir de un hallazgo admitido." });
    const admitted = transitionMemory(record, "admitted", {
      at: "2026-08-29T01:00:00.000Z",
      why: "Lo guardo para el siguiente caso.",
      actor: "operator",
      policy: "operator-admission",
      decisionId: "d1",
    });
    assert.equal(admitted.ok, true);
    if (!admitted.ok) return;
    const revoked = transitionMemory(admitted.value.record, "revoked", {
      at: "2026-08-29T02:00:00.000Z",
      why: "Olvidada por el operador.",
      actor: "operator",
      policy: "operator-revoke",
      decisionId: "d2",
    });
    assert.equal(revoked.ok, true);
    if (!revoked.ok) return;
    const explained = explainMemory({
      memoryId: "m1",
      memory: [revoked.value.record],
      decisions: [birth, admitted.value.decision, revoked.value.decision],
      dossiers: [],
      contradictions: [],
    });
    assert.ok(explained);
    assert.deepEqual(
      explained.decisions.map((item) => `${item.from ?? "origen"}→${item.to}`),
      ["origen→proposed", "proposed→admitted", "admitted→revoked"],
    );
    assert.equal(explained.proposedAt, AT);
    assert.equal(explained.admittedAt, "2026-08-29T01:00:00.000Z");
    assert.equal(explained.closedAt, "2026-08-29T02:00:00.000Z");
    assert.equal(explained.lifecycle, "revoked");
    assert.equal(explained.decisions[1]?.actor, "operator");
    assert.equal(explained.decisions[1]?.policy, "operator-admission");
    assert.equal(explained.decisions[2]?.policy, "operator-revoke");
    assert.equal(liveMemory([revoked.value.record]).length, 0);
    assert.equal(revoked.value.record.id, "m1");
  });
});

describe("identity", () => {
  it("6. does not reuse a memory id already taken by memory or evidence", () => {
    const existing = [proposed({ id: "m_taken" })];
    const id = allocateMemoryId(existing, [{ ...evidence, id: "m_also" }]);
    assert.equal(id === "m_taken", false);
    assert.equal(id === "m_also", false);
    assert.match(id, /^m_/);
  });

  it("buildProposedMemory never copies a finding evidence id onto the memory id", () => {
    const record = buildProposedMemory({
      id: "m_new",
      finding,
      why: "Lo guardo para el siguiente caso.",
      at: AT,
    });
    assert.equal(record.id === finding.evidenceIds[0], false);
    assert.equal(record.lifecycle, "proposed");
    assert.deepEqual(record.evidenceIds, finding.evidenceIds);
  });
});

describe("history versus live state", () => {
  it("7/12. keeps revoked memory identifiable from an old seal snapshot", async () => {
    const m1 = proposed({ lifecycle: "admitted", admittedAt: AT });
    const goal = {
      id: "g2",
      text: "Otro taladro de 20 euros",
      createdAt: AT,
      updatedAt: AT,
      status: "complete" as const,
      stage: "complete" as const,
      evidenceIds: ["e2"],
      findingIds: ["f2"],
      leadCount: 1,
      leads: [],
      watched: false,
    };
    const laterEvidence: Evidence = { ...evidence, id: "e2", goalId: "g2", url: "https://example.org/other" };
    const laterFinding: Finding = {
      ...finding,
      id: "f2",
      goalId: "g2",
      evidenceIds: ["e2"],
    };
    const dossier = await composeDossier({
      goal,
      findings: [laterFinding],
      evidence: [laterEvidence],
      related: [{ memory: m1, score: 0.4, overlap: 2 }],
    });
    assert.ok(dossier);
    const snap = structuredClone(dossier.known);
    const sealHash = dossier.sealHash;
    const revoked = transitionMemory(m1, "revoked", {
      at: "2026-08-29T05:00:00.000Z",
      why: "Olvidada.",
      actor: "operator",
      policy: "operator-revoke",
      decisionId: "d8",
    });
    assert.equal(revoked.ok, true);
    if (!revoked.ok) return;
    assert.deepEqual(dossier.known, snap);
    assert.equal(dossier.sealHash, sealHash);
    assert.equal(dossier.known[0]?.memoryId, "m1");
    assert.equal(dossier.known[0]?.lifecycle, "admitted");
    assert.equal(revoked.value.record.lifecycle, "revoked");
    const used = sealsUsingMemory([dossier], "m1");
    assert.equal(used[0]?.id, dossier.id);
    const explained = explainMemory({
      memoryId: "m1",
      memory: [revoked.value.record],
      decisions: [revoked.value.decision],
      dossiers: [dossier],
      contradictions: [],
    });
    assert.equal(explained?.lifecycle, "revoked");
    assert.equal(explained?.usedBySeals[0]?.lifecycleAtConsult, "admitted");
    assert.equal(explained?.usedBySeals[0]?.sealHash, dossier.sealHash);
  });

  it("8. does not treat a contradiction as deletion", () => {
    const m1 = proposed({ lifecycle: "admitted", admittedAt: AT });
    const m2 = proposed({
      id: "m2",
      findingId: "f2",
      goalId: "g2",
      lifecycle: "admitted",
      admittedAt: "2026-08-29T06:00:00.000Z",
      title: "Precio distinto",
    });
    const laterFinding: Finding = {
      ...finding,
      id: "f2",
      goalId: "g2",
      evidenceIds: ["e2"],
      title: "Precio distinto",
      delta: "tension",
      deltaNote: "La ficha lista 80 EUR, no 20.",
      deltaMemoryId: "m1",
    };
    const laterEvidence: Evidence = {
      ...evidence,
      id: "e2",
      goalId: "g2",
      url: "https://example.org/other",
      excerpt: "Taladro 80 EUR",
      contentHash: "otherhash1234567890ab",
    };
    const drafts = classifyContradictions({
      evidence: [evidence, laterEvidence],
      findings: [finding, laterFinding],
      memory: [m1, m2],
      dossiers: [],
    });
    const mm = drafts.find((item) => item.kind === "memory-memory");
    const em = drafts.find((item) => item.kind === "evidence-memory");
    assert.ok(mm);
    assert.ok(em);
    assert.equal(mm.left.kind, "memory");
    assert.equal(mm.right.kind, "memory");
    assert.equal(m1.lifecycle, "admitted");
    assert.equal(m2.lifecycle, "admitted");
    assert.equal(liveMemory([m1, m2]).length, 2);
    const explained = explainMemory({
      memoryId: "m1",
      memory: [m1, m2],
      decisions: [],
      dossiers: [],
      contradictions: [
        { ...mm, id: "c_mm", at: AT },
        { ...em, id: "c_em", at: AT },
      ],
    });
    assert.equal(explained?.lifecycle, "admitted");
    assert.equal(explained?.contradictions.length, 2);
    assert.equal(explained?.id, "m1");
  });
});

describe("memory is not evidence", () => {
  it("10. never places a memory record into evidence identity", () => {
    const record = proposed();
    const pool: Evidence[] = [evidence];
    assert.equal(pool.some((item) => item.id === record.id), false);
    assert.equal(record.evidenceIds.includes(record.id), false);
  });

  it("11. never treats a memory id as an evidenceId", () => {
    const record = proposed();
    assert.equal(finding.evidenceIds.includes(record.id), false);
    const cited = { ...finding, evidenceIds: [record.id] };
    assert.equal(cited.evidenceIds.includes("e1"), false);
    assert.equal(cited.evidenceIds[0], "m1");
    assert.equal(record.id === evidence.id, false);
  });
});
