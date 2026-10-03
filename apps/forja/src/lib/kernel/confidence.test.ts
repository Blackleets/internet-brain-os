import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  CONFIDENCE_POLICY_V1,
  KERNEL_CONFIDENCE_BOUNDARIES,
  allocateConfidenceId,
  bandOf,
  computeConfidence,
  confidenceAdmitMemory,
  confidenceSkipAuthority,
  deriveConfidence,
  explainConfidenceChange,
  latestConfidence,
  llmConfidenceAuthority,
  memoryIdAsEvidenceFromConfidence,
  mergeConfidence,
  mutateCodeFromConfidence,
  mutatePoliciesFromConfidence,
  openSupportConflicts,
  overwriteEvaluation,
  recalculateOnReplay,
} from "./confidence.ts";
import { skipAuthorityAdmit } from "./learning.ts";
import { replaySeal } from "./replay.ts";
import type {
  ConfidencePolicy,
  Contradiction,
  Evidence,
  Finding,
  KernelState,
  LearningCandidate,
  MemoryRecord,
} from "./types.ts";

const T0 = "2026-08-29T00:00:00.000Z";
const T1 = "2026-08-29T01:00:00.000Z";
const T2 = "2026-08-29T02:00:00.000Z";
const T3 = "2026-08-29T03:00:00.000Z";

const evidence: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro 20 EUR",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR observado en ficha pública.",
  contentHash: "hash20eur1234567890ab",
  retrievedAt: T0,
  httpStatus: 200,
  bytes: 40,
  validation: "retrieved",
};

const other: Evidence = {
  ...evidence,
  id: "e2",
  url: "https://shop.example.org/drill",
  sourceHost: "shop.example.org",
  contentHash: "hash20eurOTHER1234567",
  title: "Taladro 20 EUR en otra ficha",
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
  createdAt: T0,
};

const memory: MemoryRecord = {
  id: "m1",
  findingId: "f0",
  goalId: "g0",
  title: "Taladro Bosch de 20 euros",
  why: "Precio verificado en una ficha pública.",
  evidenceIds: ["e0"],
  proposedAt: T0,
  admittedAt: T0,
  lifecycle: "admitted",
  informedGoalIds: [],
};

function contradiction(
  over: Partial<Contradiction> & Pick<Contradiction, "id" | "kind" | "left" | "right">,
): Contradiction {
  return {
    goalId: "g1",
    note: "Tensión registrada.",
    open: true,
    at: T1,
    ...over,
  };
}

function evalOf(over: Partial<Parameters<typeof computeConfidence>[0]> = {}) {
  return computeConfidence({
    finding,
    evidence: [evidence],
    memory: [],
    contradictions: [],
    at: T0,
    ...over,
  });
}

function emptyKernel(over: Partial<KernelState> = {}): KernelState {
  return {
    goals: [],
    evidence: [],
    findings: [],
    memory: [],
    memoryDecisions: [],
    dossiers: [],
    watchPasses: [],
    contradictions: [],
    learning: [],
    learningDecisions: [],
    confidence: [],
    activity: [],
    chat: [],
    ...over,
  };
}

function sealOf() {
  return {
    id: "d1",
    goalId: "g1",
    sealedAt: T1,
    sealHash: "seal-d1-abcdef123456",
    executive: finding.answer,
    known: [],
    memoryContextHash: "",
    novel: [],
    confirmed: [],
    tensions: [],
    uncertain: [],
    next: "",
    findingIds: ["f1"],
    evidenceIds: ["e1"],
    evidenceHashes: [evidence.contentHash],
    sourceHosts: ["example.com"],
    interpretationAvailable: true,
    memoryConsulted: 0,
    reusedCount: 0,
  };
}

describe("confidence engine", () => {
  it("1. same input yields the same score", () => {
    const a = evalOf();
    const b = evalOf();
    assert.equal(a.score, b.score);
    assert.equal(a.band, b.band);
    assert.deepEqual(a.reasons, b.reasons);
    assert.equal(a.inputHash, b.inputHash);
    assert.equal(a.algorithm, CONFIDENCE_POLICY_V1.algorithm);
  });

  it("2. more independent evidence increases support when it should", () => {
    const one = evalOf({ evidence: [evidence], finding });
    const two = evalOf({
      evidence: [evidence, other],
      finding: { ...finding, evidenceIds: ["e1", "e2"] },
    });
    assert.equal(two.score > one.score, true);
    assert.equal(
      two.reasons.some((item) => item.kind === "independent-evidence" && item.delta > 14),
      true,
    );
  });

  it("3. contradictory evidence reduces confidence", () => {
    const clean = evalOf();
    const tensed = evalOf({
      evidence: [evidence, { ...evidence, id: "e1b", contentHash: "hash80eur1234567890ab" }],
      contradictions: [
        contradiction({
          id: "c-ee",
          kind: "evidence-evidence",
          left: { kind: "evidence", id: "e1", label: evidence.title, fingerprint: evidence.contentHash },
          right: { kind: "evidence", id: "e1b", label: "Taladro 80 EUR", fingerprint: "hash80eur1234567890ab" },
        }),
      ],
    });
    assert.equal(tensed.score < clean.score, true);
    assert.equal(tensed.reasons.some((item) => item.kind === "incompatible-evidence"), true);
    assert.equal(tensed.score <= CONFIDENCE_POLICY_V1.caps.openEvidenceContradictionMax, true);
  });

  it("4. an open contradiction remains visible even with high support", () => {
    const third: Evidence = {
      ...other,
      id: "e3",
      sourceHost: "market.example.net",
      url: "https://market.example.net/drill",
      contentHash: "hash20eurTHIRD123456",
    };
    const withRelated = evalOf({
      evidence: [evidence, other, third],
      finding: { ...finding, evidenceIds: ["e1", "e2", "e3"], deltaMemoryId: "m1", delta: "tension" },
      memory: [memory],
      contradictions: [
        contradiction({
          id: "c-em",
          kind: "evidence-memory",
          left: { kind: "evidence", id: "e1", label: evidence.title },
          right: { kind: "memory", id: "m1", label: memory.title },
          findingId: "f1",
        }),
      ],
    });
    assert.equal(openSupportConflicts(withRelated).length > 0, true);
    assert.equal(withRelated.reasons.some((item) => item.kind === "open-evidence-memory"), true);
  });

  it("5. a resolved contradiction is distinguished from an open one", () => {
    const open = evalOf({
      contradictions: [
        contradiction({
          id: "c1",
          kind: "evidence-memory",
          open: true,
          left: { kind: "evidence", id: "e1", label: evidence.title },
          right: { kind: "memory", id: "m1", label: memory.title },
          findingId: "f1",
        }),
      ],
      memory: [memory],
      finding: { ...finding, deltaMemoryId: "m1" },
    });
    const closed = evalOf({
      contradictions: [
        contradiction({
          id: "c1",
          kind: "evidence-memory",
          open: false,
          left: { kind: "evidence", id: "e1", label: evidence.title },
          right: { kind: "memory", id: "m1", label: memory.title },
          findingId: "f1",
        }),
      ],
      memory: [memory],
      finding: { ...finding, deltaMemoryId: "m1" },
    });
    assert.equal(open.reasons.some((item) => item.kind === "open-evidence-memory"), true);
    assert.equal(closed.reasons.some((item) => item.kind === "open-evidence-memory"), false);
    assert.equal(closed.reasons.some((item) => item.kind === "resolved-contradiction"), true);
    assert.equal(closed.score > open.score, true);
  });

  it("6. revoked memory does not count as live support", () => {
    const live = evalOf({
      memory: [memory],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    const revoked = evalOf({
      memory: [{ ...memory, lifecycle: "revoked", closedAt: T1 }],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    assert.equal(live.reasons.some((item) => item.kind === "live-memory-support"), true);
    assert.equal(revoked.reasons.some((item) => item.kind === "live-memory-support"), false);
    assert.equal(revoked.reasons.some((item) => item.kind === "revoked-memory"), true);
    assert.equal(revoked.score < live.score, true);
  });

  it("7. superseded memory does not count as live support", () => {
    const live = evalOf({
      memory: [memory],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    const superseded = evalOf({
      memory: [{ ...memory, lifecycle: "superseded", closedAt: T1, supersededById: "m2" }],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    assert.equal(superseded.reasons.some((item) => item.kind === "live-memory-support"), false);
    assert.equal(superseded.reasons.some((item) => item.kind === "superseded-memory"), true);
    assert.equal(superseded.score < live.score, true);
  });

  it("8. incomplete provenance reduces and caps confidence", () => {
    const complete = evalOf();
    const bare = evalOf({
      finding: { ...finding, evidenceIds: [] },
      evidence: [],
    });
    const missing = evalOf({
      finding: { ...finding, evidenceIds: ["e-missing"] },
      evidence: [],
    });
    assert.equal(bare.score < complete.score, true);
    assert.equal(bare.score <= CONFIDENCE_POLICY_V1.caps.incompleteProvenanceMax, true);
    assert.equal(bare.reasons.some((item) => item.kind === "incomplete-provenance"), true);
    assert.equal(missing.reasons.some((item) => item.kind === "incomplete-provenance"), true);
    assert.equal(bare.band === "very-low" || bare.band === "low", true);
  });

  it("9. confidence does not convert memory into evidence", () => {
    const result = evalOf({
      memory: [memory],
      finding: { ...finding, evidenceIds: ["e1", "m1"], deltaMemoryId: "m1" },
      evidence: [evidence],
    });
    assert.equal(result.evidenceIds.includes("m1"), false);
    assert.equal(result.memoryIds.includes("m1"), true);
    assert.equal(memoryIdAsEvidenceFromConfidence("m1").ok, false);
  });

  it("10. confidence does not admit memory", () => {
    const result = evalOf();
    const merged = mergeConfidence([], [result], { now: T0, nextId: () => "cf1" });
    const admitted = confidenceAdmitMemory(merged.records[0]);
    assert.equal(admitted.ok, false);
    assert.equal(KERNEL_CONFIDENCE_BOUNDARIES.mayAdmitMemory, false);
  });

  it("11. a high-confidence learning candidate still goes through Memory Authority", () => {
    const high = evalOf({
      evidence: [
        evidence,
        other,
        { ...other, id: "e3", sourceHost: "market.example.net", url: "https://market.example.net/x", contentHash: "h3" },
      ],
      finding: { ...finding, evidenceIds: ["e1", "e2", "e3"] },
    });
    assert.equal(high.band === "high" || high.band === "very-high", true);
    const candidate: LearningCandidate = {
      id: "l1",
      createdAt: T0,
      status: "ready",
      relation: "novel",
      title: finding.title,
      proposal: finding.answer,
      origin: {
        kind: "finding",
        note: "Hallazgo nuevo con evidencia observada.",
        goalIds: ["g1"],
        findingIds: ["f1"],
        evidenceIds: ["e1", "e2", "e3"],
        contradictionIds: [],
        sealIds: [],
        memoryIds: [],
      },
      evidenceIds: ["e1", "e2", "e3"],
      findingIds: ["f1"],
      caseIds: ["g1"],
      relatedMemoryIds: [],
      contradictionIds: [],
    };
    assert.equal(skipAuthorityAdmit(candidate).ok, false);
    const record = mergeConfidence([], [high], { now: T0, nextId: () => "cf1" }).records[0];
    assert.equal(confidenceSkipAuthority(record).ok, false);
  });

  it("12. a historical evaluation remains immutable", () => {
    const first = evalOf();
    const merged = mergeConfidence([], [first], { now: T0, nextId: () => "cf1" });
    const snapshot = structuredClone(merged.records[0]);
    const later = evalOf({
      evidence: [evidence, other],
      finding: { ...finding, evidenceIds: ["e1", "e2"] },
      at: T2,
    });
    const second = mergeConfidence(merged.records, [later], { now: T2, nextId: () => "cf2" });
    const kept = second.records.find((item) => item.id === "cf1");
    assert.deepEqual(kept, snapshot);
    assert.equal(overwriteEvaluation(snapshot, { score: 99 }).ok, false);
  });

  it("13. a second evaluation creates a new version", () => {
    const first = mergeConfidence([], [evalOf()], { now: T0, nextId: () => "cf1" });
    const later = evalOf({
      evidence: [evidence, other],
      finding: { ...finding, evidenceIds: ["e1", "e2"] },
      at: T2,
    });
    const second = mergeConfidence(first.records, [later], { now: T2, nextId: () => "cf2" });
    assert.equal(second.created.length, 1);
    assert.equal(second.created[0]?.id, "cf2");
    assert.equal(second.created[0]?.version, 2);
    assert.equal(second.created[0]?.previousId, "cf1");
    assert.equal(second.records.length, 2);
    assert.equal(latestConfidence(second.records, "f1")?.id, "cf2");
  });

  it("14. replay reconstructs the historical score", () => {
    const v1 = mergeConfidence([], [evalOf({ at: T0 })], { now: T0, nextId: () => "cf1" }).records[0];
    const later = evalOf({
      evidence: [evidence, other],
      finding: { ...finding, evidenceIds: ["e1", "e2"] },
      at: T3,
    });
    const v2 = mergeConfidence([v1], [later], { now: T3, nextId: () => "cf2" }).created[0];
    const replay = replaySeal(
      emptyKernel({
        evidence: [evidence, other],
        findings: [{ ...finding, evidenceIds: ["e1", "e2"] }],
        dossiers: [sealOf()],
        confidence: [v2, v1],
      }),
      "d1",
    );
    assert.equal(replay.confidence.length, 1);
    assert.equal(replay.confidence[0]?.id, "cf1");
    assert.equal(replay.confidence[0]?.score, v1.score);
    assert.equal(replay.confidence[0]?.id === v2.id, false);
  });

  it("15. replay uses the historical policy, not the current one", () => {
    const v1 = mergeConfidence([], [evalOf({ at: T0 })], { now: T0, nextId: () => "cf1" }).records[0];
    const heavier: ConfidencePolicy = {
      ...CONFIDENCE_POLICY_V1,
      version: 2,
      id: "confidence-v2",
      weights: { ...CONFIDENCE_POLICY_V1.weights, independentSource: 40 },
    };
    const live = evalOf({ at: T3, policy: heavier });
    assert.equal(live.policyVersion, 2);
    assert.equal(live.score === v1.score, false);
    const replay = replaySeal(
      emptyKernel({
        evidence: [evidence],
        findings: [finding],
        dossiers: [sealOf()],
        confidence: [v1],
      }),
      "d1",
    );
    assert.equal(replay.confidence[0]?.policyVersion, 1);
    assert.equal(replay.confidence[0]?.policyId, "confidence-v1");
    assert.equal(replay.confidence[0]?.algorithm, CONFIDENCE_POLICY_V1.algorithm);
    assert.equal(replay.confidence[0]?.score, v1.score);
    assert.equal(recalculateOnReplay(v1, heavier).ok, false);
  });

  it("16. replay does not recalculate with current memory", () => {
    const v1 = mergeConfidence(
      [],
      [evalOf({ at: T0, memory: [memory], finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" } })],
      { now: T0, nextId: () => "cf1" },
    ).records[0];
    const revoked = evalOf({
      at: T3,
      memory: [{ ...memory, lifecycle: "revoked", closedAt: T2 }],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    const v2 = mergeConfidence([v1], [revoked], { now: T3, nextId: () => "cf2" }).created[0];
    assert.equal(v2.score < v1.score, true);
    const replay = replaySeal(
      emptyKernel({
        evidence: [evidence],
        findings: [{ ...finding, deltaMemoryId: "m1", delta: "confirmed" }],
        memory: [{ ...memory, lifecycle: "revoked", closedAt: T2 }],
        dossiers: [sealOf()],
        confidence: [v2, v1],
      }),
      "d1",
    );
    assert.equal(replay.confidence[0]?.id, "cf1");
    assert.equal(replay.confidence[0]?.score, v1.score);
    assert.equal(replay.confidence[0]?.reasons.some((item) => item.kind === "live-memory-support"), true);
  });

  it("17. replay and confidence never call the network", () => {
    const src = readFileSync(fileURLToPath(new URL("./confidence.ts", import.meta.url)), "utf8");
    const replaySrc = readFileSync(fileURLToPath(new URL("./replay.ts", import.meta.url)), "utf8");
    assert.equal(/readPublicWeb|searchPublicWeb|interpretEvidence/.test(src), false);
    assert.equal(/from ["'].*research/.test(src), false);
    assert.equal(/fetch\(/.test(src), false);
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new Error("Confidence no consulta la red");
    }) as typeof fetch;
    try {
      const draft = evalOf();
      const merged = mergeConfidence([], [draft], { now: T0, nextId: () => "cf1" });
      replaySeal(
        emptyKernel({
          evidence: [evidence],
          findings: [finding],
          dossiers: [sealOf()],
          confidence: merged.records,
        }),
        "d1",
      );
      assert.deepEqual(calls, []);
      assert.equal(/fetch\(/.test(replaySrc), false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("18. algorithm and version are recorded", () => {
    const result = evalOf();
    assert.equal(result.algorithm, "efesto-support-v1");
    assert.equal(result.policyId, "confidence-v1");
    assert.equal(result.policyVersion, 1);
    const merged = mergeConfidence([], [result], { now: T0, nextId: () => "cf1" }).records[0];
    assert.equal(merged.version, 1);
    assert.equal(merged.algorithm, result.algorithm);
  });

  it("19. an evidence change explains the score change", () => {
    const v1 = mergeConfidence([], [evalOf({ at: T0 })], { now: T0, nextId: () => "cf1" }).records[0];
    const later = evalOf({
      evidence: [evidence, other],
      finding: { ...finding, evidenceIds: ["e1", "e2"] },
      at: T2,
    });
    const v2 = mergeConfidence([v1], [later], { now: T2, nextId: () => "cf2" }).created[0];
    const notes = explainConfidenceChange(v1, v2);
    assert.match(notes.join(" "), /evidencia/i);
    assert.match(v2.changeNote ?? "", /evidencia/i);
    assert.equal(v2.score > v1.score, true);
  });

  it("20. a memory change explains the score change", () => {
    const v1 = mergeConfidence(
      [],
      [evalOf({ at: T0, memory: [memory], finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" } })],
      { now: T0, nextId: () => "cf1" },
    ).records[0];
    const later = evalOf({
      at: T2,
      memory: [{ ...memory, lifecycle: "revoked", closedAt: T2 }],
      finding: { ...finding, deltaMemoryId: "m1", delta: "confirmed" },
    });
    const v2 = mergeConfidence([v1], [later], { now: T2, nextId: () => "cf2" }).created[0];
    const notes = explainConfidenceChange(v1, v2);
    assert.match(notes.join(" "), /memoria/i);
    assert.match(v2.changeNote ?? "", /memoria/i);
    assert.equal(v2.score < v1.score, true);
  });

  it("21. an interpretation shift is not classified as contradictory evidence", () => {
    const before = evalOf();
    const after = evalOf({
      contradictions: [
        contradiction({
          id: "c-ii",
          kind: "interpretation-interpretation",
          left: { kind: "seal", id: "d1", label: "Sello 1" },
          right: { kind: "seal", id: "d2", label: "Sello 2" },
          findingId: "f1",
        }),
      ],
    });
    assert.equal(after.reasons.some((item) => item.kind === "interpretation-shift"), true);
    assert.equal(after.reasons.some((item) => item.kind === "incompatible-evidence"), false);
    const note = after.reasons.find((item) => item.kind === "interpretation-shift")?.note ?? "";
    assert.match(note, /interpretación/i);
    assert.equal(/evidencia contra evidencia/.test(note), true);
    assert.equal(after.reasons.some((item) => item.kind === "incompatible-evidence"), false);
    const notes = explainConfidenceChange(
      { ...before, id: "cf1", version: 1 },
      { ...after, id: "cf2", version: 2, previousId: "cf1" },
    );
    assert.equal(
      notes.some((item) => /evidencia contradictoria/.test(item) && !/interpretación/.test(item)),
      false,
    );
  });
});

describe("confidence security", () => {
  it("refuses confidence → admitted memory", () => {
    const record = mergeConfidence([], [evalOf()], { now: T0, nextId: () => "cf1" }).records[0];
    assert.equal(confidenceAdmitMemory(record).ok, false);
  });

  it("refuses memoryId → evidenceId", () => {
    assert.equal(memoryIdAsEvidenceFromConfidence("m1").ok, false);
  });

  it("refuses overwriting a historical evaluation", () => {
    const record = mergeConfidence([], [evalOf()], { now: T0, nextId: () => "cf1" }).records[0];
    assert.equal(overwriteEvaluation(record, { score: 1 }).ok, false);
  });

  it("refuses replay recalculation with the current policy", () => {
    const record = mergeConfidence([], [evalOf()], { now: T0, nextId: () => "cf1" }).records[0];
    assert.equal(recalculateOnReplay(record, CONFIDENCE_POLICY_V1).ok, false);
  });

  it("refuses the LLM as confidence authority", () => {
    assert.equal(llmConfidenceAuthority().ok, false);
    assert.equal(KERNEL_CONFIDENCE_BOUNDARIES.mayUseLlmAsAuthority, false);
  });

  it("does not mutate policies or code", () => {
    const before = CONFIDENCE_POLICY_V1.version;
    assert.equal(mutatePoliciesFromConfidence().ok, false);
    assert.equal(mutateCodeFromConfidence().ok, false);
    assert.equal(CONFIDENCE_POLICY_V1.version, before);
    assert.equal(KERNEL_CONFIDENCE_BOUNDARIES.mayMutatePolicies, false);
    assert.equal(KERNEL_CONFIDENCE_BOUNDARIES.mayMutateCode, false);
  });

  it("does not reuse confidence ids", () => {
    const id = allocateConfidenceId([
      {
        ...evalOf(),
        id: "cf_taken",
        version: 1,
      },
    ]);
    assert.equal(id === "cf_taken", false);
    assert.match(id, /^cf_/);
  });
});

describe("confidence helpers", () => {
  it("maps scores onto interpretable bands", () => {
    assert.equal(bandOf(0), "very-low");
    assert.equal(bandOf(19), "very-low");
    assert.equal(bandOf(20), "low");
    assert.equal(bandOf(40), "medium");
    assert.equal(bandOf(60), "high");
    assert.equal(bandOf(80), "very-high");
  });

  it("deriveConfidence is deterministic across finding order", () => {
    const a = deriveConfidence({
      findings: [finding, { ...finding, id: "f2", evidenceIds: ["e2"] }],
      evidence: [evidence, other],
      memory: [],
      contradictions: [],
    });
    const b = deriveConfidence({
      findings: [{ ...finding, id: "f2", evidenceIds: ["e2"] }, finding],
      evidence: [evidence, other],
      memory: [],
      contradictions: [],
    });
    assert.deepEqual(
      a.map((item) => item.findingId),
      b.map((item) => item.findingId),
    );
    assert.equal(a[0]?.score, b[0]?.score);
  });
});
