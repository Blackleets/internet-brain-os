import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  acceptOfferedMemory,
  allocateLearningId,
  candidateIsMemory,
  classifyFinding,
  KERNEL_LEARNING_BOUNDARIES,
  memoryIdAsEvidence,
  mergeLearning,
  mutateCodeFromLearning,
  mutatePoliciesFromLearning,
  observeFinding,
  offerToAuthority,
  reviveRevokedWithLearning,
  skipAuthorityAdmit,
  validateLearning,
} from "./learning.ts";
import { replaySeal } from "./replay.ts";
import type {
  Contradiction,
  Evidence,
  Finding,
  KernelState,
  LearningCandidate,
  MemoryRecord,
} from "./types.ts";

const T0 = "2026-08-29T00:00:00.000Z";
const T1 = "2026-08-29T01:00:00.000Z";
const T3 = "2026-08-29T03:00:00.000Z";
const WHY = "Lo guardo para el siguiente caso.";

const e1: Evidence = {
  id: "e1",
  goalId: "g1",
  url: "https://example.com/drill",
  title: "Taladro 20 EUR",
  sourceHost: "example.com",
  excerpt: "Taladro 20 EUR",
  contentHash: "hash20eur1234567890ab",
  retrievedAt: T0,
  httpStatus: 200,
  bytes: 12,
  validation: "retrieved",
};

const f1: Finding = {
  id: "f1",
  goalId: "g1",
  title: "Precio observado",
  answer: "Hay un taladro a 20 EUR",
  whyItMatters: "Encaja en el rango.",
  confidence: "medium",
  evidenceIds: ["e1"],
  uncertainties: [],
  nextAction: "Comparar otra fuente",
  interpretationAvailable: true,
  createdAt: T0,
};

const m1: MemoryRecord = {
  id: "m1",
  findingId: "f0",
  goalId: "g0",
  title: "Taladro Bosch de 20 euros",
  why: "Precio verificado en una ficha pública.",
  evidenceIds: ["e0"],
  admittedAt: T0,
  lifecycle: "admitted",
  informedGoalIds: ["g1"],
};

describe("learning loop", () => {
  it("1. a case produces a learning candidate", () => {
    const classified = classifyFinding(f1, []);
    assert.equal(classified.relation, "novel");
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [],
      findings: [f1],
    });
    assert.equal(draft.relation, "novel");
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l1" });
    assert.equal(merged.candidates.length, 1);
    assert.equal(merged.candidates[0]?.id, "l1");
    assert.equal(merged.candidates[0]?.status, "ready");
    assert.equal(merged.candidates[0]?.title, f1.title);
    assert.equal(merged.candidates[0]?.proposal, f1.answer);
    assert.equal(merged.decisions[0]?.from, null);
    assert.equal(merged.decisions[0]?.to, "ready");
    assert.equal(merged.decisions[0]?.actor, "kernel");
  });

  it("2. the candidate keeps provenance", () => {
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [],
      findings: [f1],
    });
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l1" });
    const candidate = merged.candidates[0];
    assert.ok(candidate);
    assert.equal(candidate.origin.kind, "finding");
    assert.deepEqual(candidate.origin.findingIds, ["f1"]);
    assert.deepEqual(candidate.origin.evidenceIds, ["e1"]);
    assert.deepEqual(candidate.origin.goalIds, ["g1"]);
    assert.deepEqual(candidate.findingIds, ["f1"]);
    assert.deepEqual(candidate.evidenceIds, ["e1"]);
    assert.deepEqual(candidate.caseIds, ["g1"]);
    assert.equal(MODEL_THOUGHT_SAFE(candidate.origin.note), true);
    assert.equal(candidate.origin.note.trim().length > 0, true);
  });

  it("3. the candidate references evidence, not memory, as evidenceId", () => {
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [m1],
      findings: [f1],
    });
    assert.deepEqual(draft.evidenceIds, ["e1"]);
    assert.equal(draft.evidenceIds.includes("m1"), false);
    const invalid = validateLearning(asCandidate({ evidenceIds: ["m1"] }), {
      evidence: [e1],
      memory: [m1],
      findings: [f1],
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) assert.match(invalid.reason, /memoria no es evidencia/i);
  });

  it("4. a candidate cannot become admitted memory by itself", () => {
    const skip = skipAuthorityAdmit(asCandidate());
    assert.equal(skip.ok, false);
    const offered = offerToAuthority({
      candidate: asCandidate(),
      finding: f1,
      evidence: [e1],
      memory: [],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, true);
    if (!offered.ok) return;
    assert.equal(offered.value.proposed.lifecycle, "proposed");
    assert.equal(offered.value.candidate.status, "proposed");
    assert.equal(candidateIsMemory(offered.value.candidate), false);
    assert.equal(candidateIsMemory(asCandidate()), false);
    const second = offerToAuthority({
      candidate: offered.value.candidate,
      finding: f1,
      evidence: [e1],
      memory: [],
      at: T1,
      why: WHY,
      memoryId: "m3",
    });
    assert.equal(second.ok, false);
  });

  it("5. a contradictory candidate produces a contradiction and does not overwrite", () => {
    const tensed: Finding = {
      ...f1,
      id: "f2",
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: "m1",
    };
    assert.equal(classifyFinding(tensed, [m1]).relation, "contradiction");
    const draft = observeFinding({
      finding: tensed,
      evidence: [e1],
      memory: [m1],
      findings: [tensed],
    });
    assert.equal(draft.relation, "contradiction");
    assert.equal(draft.contradictionDraft?.kind, "evidence-memory");
    assert.equal(draft.contradictionDraft?.left.kind, "evidence");
    assert.equal(draft.contradictionDraft?.right.kind, "memory");
    assert.equal(draft.contradictionDraft?.right.id, "m1");
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l2" });
    assert.equal(merged.candidates[0]?.status, "contradicted");
    assert.equal(merged.contradictionDrafts[0]?.kind, "evidence-memory");
    const recorded: Contradiction[] = merged.contradictionDrafts.map((item, index) => ({
      ...item,
      id: `x${index}`,
      at: T0,
    }));
    assert.equal(recorded[0]?.kind, "evidence-memory");
    const offered = offerToAuthority({
      candidate: merged.candidates[0]!,
      finding: tensed,
      evidence: [e1],
      memory: [m1],
      at: T1,
      why: "Sobrescribo la memoria admitida.",
      memoryId: "m2",
    });
    assert.equal(offered.ok, false);
    assert.equal(m1.lifecycle, "admitted");
  });

  it("6. a duplicate candidate is detected", () => {
    const duplicateMemory: MemoryRecord = {
      ...m1,
      findingId: "f1",
      title: f1.title,
      why: f1.answer,
    };
    assert.equal(classifyFinding(f1, [duplicateMemory]).relation, "duplicate");
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [duplicateMemory],
      findings: [f1],
    });
    assert.equal(draft.relation, "duplicate");
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l3" });
    assert.equal(merged.candidates[0]?.status, "duplicate");
    const offered = offerToAuthority({
      candidate: merged.candidates[0]!,
      finding: f1,
      evidence: [e1],
      memory: [duplicateMemory],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, false);
  });

  it("7. reinforcement does not create another memory", () => {
    const confirmed: Finding = {
      ...f1,
      id: "f3",
      delta: "confirmed",
      deltaMemoryId: "m1",
    };
    assert.equal(classifyFinding(confirmed, [m1]).relation, "reinforcement");
    const draft = observeFinding({
      finding: confirmed,
      evidence: [e1],
      memory: [m1],
      findings: [confirmed],
    });
    assert.equal(draft.relation, "reinforcement");
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l4" });
    assert.equal(merged.candidates[0]?.status, "reinforcement");
    const offered = offerToAuthority({
      candidate: merged.candidates[0]!,
      finding: confirmed,
      evidence: [e1],
      memory: [m1],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, false);
  });

  it("8. refinement keeps lineage through Memory Authority", () => {
    const refined: Finding = {
      ...f1,
      id: "f4",
      title: "Precio precisado",
      answer: "Taladro Bosch a 20 EUR en ficha pública.",
      delta: "novel",
      deltaMemoryId: "m1",
    };
    assert.equal(classifyFinding(refined, [m1]).relation, "refinement");
    const draft = observeFinding({
      finding: refined,
      evidence: [e1],
      memory: [m1],
      findings: [refined],
    });
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l8" });
    const offered = offerToAuthority({
      candidate: merged.candidates[0]!,
      finding: refined,
      evidence: [e1],
      memory: [m1],
      at: T1,
      why: "Preciso la memoria anterior.",
      memoryId: "m2",
    });
    assert.equal(offered.ok, true);
    if (!offered.ok) return;
    assert.equal(offered.value.proposed.supersedesId, "m1");
    assert.equal(offered.value.proposed.lifecycle, "proposed");
    const accepted = acceptOfferedMemory({
      proposed: offered.value.proposed,
      why: "Preciso la memoria anterior.",
      at: T1,
      relatedMemoryId: "m1",
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.value.record.lifecycle, "admitted");
    assert.equal(accepted.value.record.id === "m1", false);
    assert.equal(accepted.value.record.supersedesId, "m1");
  });

  it("9. replacement goes through Memory Authority", () => {
    const offered = offerToAuthority({
      candidate: asCandidate(),
      finding: f1,
      evidence: [e1],
      memory: [],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, true);
    if (!offered.ok) return;
    const accepted = acceptOfferedMemory({
      proposed: offered.value.proposed,
      why: WHY,
      at: T1,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.value.decision.policy, "operator-admission");
    assert.equal(accepted.value.decision.actor, "operator");
    assert.equal(accepted.value.record.lifecycle, "admitted");
    assert.equal(KERNEL_LEARNING_BOUNDARIES.maySkipAuthority, false);
  });

  it("10. revoked memory does not re-enter automatically", () => {
    const revoked: MemoryRecord = { ...m1, lifecycle: "revoked", closedAt: T1 };
    const revive = reviveRevokedWithLearning(revoked);
    assert.equal(revive.ok, false);
    const confirmed: Finding = {
      ...f1,
      id: "f5",
      delta: "confirmed",
      deltaMemoryId: "m1",
    };
    const gate = validateLearning(
      asCandidate({
        relation: "reinforcement",
        relatedMemoryIds: ["m1"],
        findingIds: ["f5"],
      }),
      { evidence: [e1], memory: [revoked], findings: [confirmed] },
    );
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.match(gate.reason, /revocada/);
    const refined: Finding = {
      ...f1,
      id: "f6",
      delta: "novel",
      deltaMemoryId: "m1",
    };
    const draft = observeFinding({
      finding: refined,
      evidence: [e1],
      memory: [revoked],
      findings: [refined],
    });
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l10" });
    const offered = offerToAuthority({
      candidate: { ...merged.candidates[0]!, relation: "refinement", relatedMemoryId: "m1" },
      finding: refined,
      evidence: [e1],
      memory: [revoked],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, false);
  });

  it("11. memory is not evidence", () => {
    const asEvidence = memoryIdAsEvidence("m1");
    assert.equal(asEvidence.ok, false);
    if (!asEvidence.ok) assert.match(asEvidence.reason, /memoria no es evidencia/i);
    assert.equal(KERNEL_LEARNING_BOUNDARIES.mayTreatMemoryAsEvidence, false);
    const cited = validateLearning(asCandidate({ evidenceIds: ["m1"], relatedMemoryIds: ["m1"] }), {
      evidence: [e1],
      memory: [m1],
      findings: [f1],
    });
    assert.equal(cited.ok, false);
  });

  it("12. learning does not mutate Kernel policies", () => {
    const mutated = mutatePoliciesFromLearning();
    assert.equal(mutated.ok, false);
    assert.equal(KERNEL_LEARNING_BOUNDARIES.mayMutatePolicies, false);
    assert.equal(KERNEL_LEARNING_BOUNDARIES.mayMutateGates, false);
  });

  it("13. learning does not mutate code or configuration", () => {
    const src = readFileSync(fileURLToPath(new URL("./learning.ts", import.meta.url)), "utf8");
    assert.equal(/writeFile|unlinkSync|chmod/.test(src), false);
    const mutated = mutateCodeFromLearning();
    assert.equal(mutated.ok, false);
    assert.equal(KERNEL_LEARNING_BOUNDARIES.mayMutateCode, false);
  });

  it("14. a candidate without enough evidence stays not admitted", () => {
    const thin: Finding = { ...f1, evidenceIds: [] };
    const draft = observeFinding({
      finding: thin,
      evidence: [e1],
      memory: [],
      findings: [thin],
    });
    assert.ok(draft.blockedReason);
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l14" });
    assert.equal(merged.candidates[0]?.status, "blocked");
    const offered = offerToAuthority({
      candidate: merged.candidates[0]!,
      finding: thin,
      evidence: [e1],
      memory: [],
      at: T1,
      why: "Sin evidencia suficiente.",
      memoryId: "m2",
    });
    assert.equal(offered.ok, false);
  });

  it("15. replay can reconstruct the candidate origin", () => {
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [],
      findings: [f1],
    });
    const merged = mergeLearning([], [draft], { now: T0, nextId: () => "l1" });
    assert.equal(merged.candidates[0]?.status, "ready");
    const live: LearningCandidate = {
      ...merged.candidates[0]!,
      status: "admitted",
      closedAt: T3,
      memoryId: "m2",
    };
    const admitDecision = {
      id: "ld_admit",
      candidateId: live.id,
      at: T3,
      from: "ready" as const,
      to: "admitted" as const,
      why: "El operador admite el aprendizaje.",
      actor: "operator" as const,
      policy: "operator-admission" as const,
      memoryId: "m2",
    };
    const seal = {
      id: "d1",
      goalId: "g1",
      sealedAt: T1,
      sealHash: "sealhash1234567890ab",
      executive: f1.answer,
      known: [],
      memoryContextHash: "",
      novel: [] as string[],
      confirmed: [] as string[],
      tensions: [] as string[],
      uncertain: [] as string[],
      next: "",
      findingIds: ["f1"],
      evidenceIds: ["e1"],
      evidenceHashes: [e1.contentHash],
      sourceHosts: [e1.sourceHost],
      interpretationAvailable: true,
      memoryConsulted: 0,
      reusedCount: 0,
    };
    const goal = {
      id: "g1",
      text: "Taladro 18-25 euros",
      createdAt: T0,
      updatedAt: T0,
      status: "complete" as const,
      stage: "complete" as const,
      evidenceIds: ["e1"],
      findingIds: ["f1"],
      leadCount: 1,
      leads: [],
      watched: false,
    };
    const kernel = emptyKernel({
      goals: [goal],
      evidence: [e1],
      findings: [f1],
      dossiers: [seal],
      learning: [live],
      learningDecisions: [...merged.decisions, admitDecision],
    });
    const replay = replaySeal(kernel, "d1");
    assert.equal(replay.learning.candidates[0]?.status, "ready");
    assert.equal(replay.learning.candidates[0]?.memoryId, undefined);
    assert.equal(
      replay.learning.decisions.some((item) => item.to === "admitted"),
      false,
    );
    assert.equal(replay.reconstructed.includes("aprendizaje"), true);

    const leak = replaySeal(
      emptyKernel({
        goals: [goal],
        evidence: [e1],
        findings: [f1],
        dossiers: [seal],
        learning: [live],
        learningDecisions: [admitDecision],
      }),
      "d1",
    );
    assert.equal(leak.learning.candidates[0]?.status === "admitted", false);
    assert.equal(
      leak.learning.decisions.some((item) => item.to === "admitted"),
      false,
    );
  });

  it("16. admitting memory keeps candidateId and provenance", () => {
    const candidate = asCandidate();
    const offered = offerToAuthority({
      candidate,
      finding: f1,
      evidence: [e1],
      memory: [],
      at: T1,
      why: WHY,
      memoryId: "m2",
    });
    assert.equal(offered.ok, true);
    if (!offered.ok) return;
    assert.equal(offered.value.proposed.candidateId, candidate.id);
    assert.deepEqual(offered.value.proposed.evidenceIds, ["e1"]);
    assert.equal(offered.value.proposed.findingId, "f1");
    const accepted = acceptOfferedMemory({
      proposed: offered.value.proposed,
      why: WHY,
      at: T1,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.value.record.candidateId, candidate.id);
    assert.equal(accepted.value.decision.candidateId, candidate.id);
    assert.deepEqual(accepted.value.record.evidenceIds, ["e1"]);
    assert.equal(accepted.value.decision.findingId, "f1");
  });

  it("17. learning history remains after admit or reject", () => {
    const admitted = asCandidate({ status: "admitted", closedAt: T1, memoryId: "m2" });
    const rejected = asCandidate({
      id: "l2",
      status: "rejected",
      closedAt: T1,
      findingIds: ["f9"],
      origin: {
        kind: "finding",
        note: "Hallazgo nuevo con evidencia observada.",
        goalIds: ["g1"],
        findingIds: ["f9"],
        evidenceIds: ["e1"],
        contradictionIds: [],
        sealIds: [],
        memoryIds: [],
      },
    });
    const draft = observeFinding({
      finding: f1,
      evidence: [e1],
      memory: [],
      findings: [f1],
    });
    const merged = mergeLearning([admitted, rejected], [draft], {
      now: T1,
      nextId: () => "l9",
    });
    const keptAdmitted = merged.candidates.find((item) => item.id === admitted.id);
    const keptRejected = merged.candidates.find((item) => item.id === rejected.id);
    assert.equal(keptAdmitted?.status, "admitted");
    assert.equal(keptRejected?.status, "rejected");
    assert.equal(keptAdmitted?.memoryId, "m2");
    assert.equal(keptAdmitted?.closedAt, T1);
    assert.equal(
      merged.candidates.some((item) => item.id === admitted.id && item.status === "ready"),
      false,
    );
  });

  it("18. the LLM cannot skip Memory Authority", () => {
    const thought = validateLearning(
      asCandidate({
        origin: {
          kind: "finding",
          note: "El modelo pensó esto",
          goalIds: ["g1"],
          findingIds: ["f1"],
          evidenceIds: ["e1"],
          contradictionIds: [],
          sealIds: [],
          memoryIds: [],
        },
      }),
      { evidence: [e1], memory: [], findings: [f1] },
    );
    assert.equal(thought.ok, false);
    if (!thought.ok) assert.match(thought.reason, /El modelo pensó esto/);
    assert.equal(KERNEL_LEARNING_BOUNDARIES.maySkipAuthority, false);
    assert.equal(skipAuthorityAdmit(asCandidate()).ok, false);
  });
});

describe("learning security", () => {
  it("skipAuthorityAdmit fails", () => {
    const skip = skipAuthorityAdmit(asCandidate());
    assert.equal(skip.ok, false);
  });

  it("memoryIdAsEvidence fails", () => {
    const asEvidence = memoryIdAsEvidence("m1");
    assert.equal(asEvidence.ok, false);
  });

  it("mutatePoliciesFromLearning fails", () => {
    assert.equal(mutatePoliciesFromLearning().ok, false);
  });

  it("mutateCodeFromLearning fails", () => {
    assert.equal(mutateCodeFromLearning().ok, false);
  });

  it("allocateLearningId does not reuse l_taken", () => {
    const id = allocateLearningId([asCandidate({ id: "l_taken" })]);
    assert.equal(id === "l_taken", false);
    assert.match(id, /^l_/);
  });
});

function asCandidate(over: Partial<LearningCandidate> = {}): LearningCandidate {
  return {
    id: "l1",
    createdAt: T0,
    status: "ready",
    relation: "novel",
    title: f1.title,
    proposal: f1.answer,
    origin: {
      kind: "finding",
      note: "Hallazgo nuevo con evidencia observada.",
      goalIds: ["g1"],
      findingIds: ["f1"],
      evidenceIds: ["e1"],
      contradictionIds: [],
      sealIds: [],
      memoryIds: [],
    },
    evidenceIds: ["e1"],
    findingIds: ["f1"],
    caseIds: ["g1"],
    relatedMemoryIds: [],
    contradictionIds: [],
    ...over,
  };
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

function MODEL_THOUGHT_SAFE(note: string) {
  return !/el modelo pens[oó]|the model thought|\bllm\b/i.test(note);
}
