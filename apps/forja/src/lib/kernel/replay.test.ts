import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  HISTORIAL_INSUFICIENTE,
  kernelFingerprint,
  replayIsReinterpretation,
  replaySeal,
  replayUsesMemory,
} from "./replay.ts";
import type {
  Contradiction,
  Dossier,
  Evidence,
  Finding,
  Goal,
  KernelState,
  KnownMemorySnapshot,
  MemoryDecision,
  MemoryRecord,
} from "./types.ts";

const T0 = "2026-08-29T00:00:00.000Z";
const T1 = "2026-08-29T01:00:00.000Z";
const T2 = "2026-08-29T02:00:00.000Z";
const T3 = "2026-08-29T03:00:00.000Z";
const T4 = "2026-08-29T04:00:00.000Z";

function goalOf(id = "g1", text = "Taladro 18-25 euros"): Goal {
  return {
    id,
    text,
    createdAt: T0,
    updatedAt: T0,
    status: "complete",
    stage: "complete",
    evidenceIds: [],
    findingIds: [],
    leadCount: 0,
    leads: [],
    watched: false,
  };
}

function evidenceOf(over: Partial<Evidence> & Pick<Evidence, "id" | "goalId">): Evidence {
  return {
    url: `https://example.com/${over.id}`,
    title: "Taladro 20 EUR",
    sourceHost: "example.com",
    excerpt: "Taladro 20 EUR observado en ficha pública.",
    contentHash: "hash20eur1234567890ab",
    retrievedAt: T0,
    httpStatus: 200,
    bytes: 40,
    validation: "retrieved",
    ...over,
  };
}

function findingOf(over: Partial<Finding> & Pick<Finding, "id" | "goalId" | "evidenceIds">): Finding {
  return {
    title: "Precio observado",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango.",
    confidence: "medium",
    uncertainties: [],
    nextAction: "",
    interpretationAvailable: true,
    createdAt: T0,
    ...over,
  };
}

function memoryOf(over: Partial<MemoryRecord> & Pick<MemoryRecord, "id">): MemoryRecord {
  return {
    findingId: "f0",
    goalId: "g0",
    title: "Taladro Bosch de 20 euros",
    why: "Precio verificado en una ficha pública.",
    evidenceIds: ["e0"],
    proposedAt: T0,
    admittedAt: T0,
    lifecycle: "admitted",
    informedGoalIds: [],
    ...over,
  };
}

function snapOf(memory: MemoryRecord, over: Partial<KnownMemorySnapshot> = {}): KnownMemorySnapshot {
  return {
    memoryId: memory.id,
    title: memory.title,
    findingId: memory.findingId,
    goalId: memory.goalId,
    admittedAt: memory.admittedAt,
    lifecycle: "admitted",
    whyHash: "whyhash1234567890abcd",
    consultedAt: T1,
    ...over,
  };
}

function dossierOf(over: Partial<Dossier> & Pick<Dossier, "id" | "goalId">): Dossier {
  return {
    sealedAt: T1,
    sealHash: `seal-${over.id}-abcdef123456`,
    executive: "Hay un taladro a 20 EUR.",
    known: [],
    memoryContextHash: "",
    novel: [],
    confirmed: [],
    tensions: [],
    uncertain: [],
    next: "",
    findingIds: [],
    evidenceIds: [],
    evidenceHashes: [],
    sourceHosts: [],
    interpretationAvailable: true,
    memoryConsulted: 0,
    reusedCount: 0,
    ...over,
  };
}

function emptyState(over: Partial<KernelState> = {}): KernelState {
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

function decision(over: Partial<MemoryDecision> & Pick<MemoryDecision, "id" | "memoryId" | "to">): MemoryDecision {
  return {
    at: T0,
    from: over.from === undefined ? "proposed" : over.from,
    why: "Lo guardo para el siguiente caso.",
    actor: "operator",
    policy: "operator-admission",
    ...over,
  };
}

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

function simpleCase() {
  const goal = goalOf();
  const evidence = evidenceOf({ id: "e1", goalId: goal.id });
  const finding = findingOf({ id: "f1", goalId: goal.id, evidenceIds: [evidence.id] });
  const seal = dossierOf({
    id: "d1",
    goalId: goal.id,
    findingIds: [finding.id],
    evidenceIds: [evidence.id],
    evidenceHashes: [evidence.contentHash],
    sourceHosts: [evidence.sourceHost],
    executive: finding.answer,
  });
  return { goal, evidence, finding, seal };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
        deepFreeze(nested);
      }
    }
  }
  return value;
}

describe("replaySeal", () => {
  it("1. reconstructs a simple seal", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        dossiers: [seal],
      }),
      seal.id,
    );
    assert.equal(result.status, "complete");
    assert.equal(result.executive, finding.answer);
    assert.equal(result.evidence[0]?.id, evidence.id);
    assert.equal(result.findings[0]?.id, finding.id);
    assert.equal(result.reconstructed.includes("sello"), true);
  });

  it("2. reconstructs a seal that consulted memory", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf(m1)],
      memoryConsulted: 1,
    };
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m1],
        dossiers: [withMemory],
      }),
      seal.id,
    );
    assert.equal(result.memory[0]?.memoryId, "m1");
    assert.equal(result.memory[0]?.lifecycleAtConsult, "admitted");
    assert.equal(replayUsesMemory(result, "m1"), true);
  });

  it("3. still uses M1 after that memory is revoked", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1", lifecycle: "revoked", closedAt: T3 });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf({ ...m1, lifecycle: "admitted" })],
      memoryConsulted: 1,
    };
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m1],
        dossiers: [withMemory],
      }),
      seal.id,
    );
    assert.equal(result.memory[0]?.memoryId, "m1");
    assert.equal(result.memory[0]?.lifecycleAtConsult, "admitted");
    assert.equal(m1.lifecycle, "revoked");
  });

  it("4. does not substitute later admitted memory for the seal consult", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const m2 = memoryOf({ id: "m2", title: "Memoria posterior", admittedAt: T3 });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf(m1)],
      memoryConsulted: 1,
    };
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m2, m1],
        dossiers: [withMemory],
      }),
      seal.id,
    );
    assert.equal(result.memory.length, 1);
    assert.equal(result.memory[0]?.memoryId, "m1");
    assert.equal(replayUsesMemory(result, "m2"), false);
  });

  it("5. reconstructs lineage S1 → S2 → S3 even when S3 is the head", () => {
    const { goal, evidence, finding } = simpleCase();
    const s1 = dossierOf({
      id: "s1",
      goalId: goal.id,
      sealedAt: T1,
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
    });
    const s2 = dossierOf({
      id: "s2",
      goalId: goal.id,
      sealedAt: T2,
      supersedesId: "s1",
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
    });
    const e2 = evidenceOf({
      id: "e2",
      goalId: goal.id,
      contentHash: "hash80eur1234567890ab",
      url: "https://example.org/other",
      sourceHost: "example.org",
    });
    const s3 = dossierOf({
      id: "s3",
      goalId: goal.id,
      sealedAt: T3,
      supersedesId: "s2",
      findingIds: [finding.id],
      evidenceIds: [evidence.id, e2.id],
      evidenceHashes: [evidence.contentHash, e2.contentHash],
    });
    const ofS1 = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence, e2],
        findings: [finding],
        dossiers: [s3, s2, s1],
      }),
      "s1",
    );
    assert.deepEqual(
      ofS1.lineage.map((item) => item.sealId),
      ["s1", "s2", "s3"],
    );
    const ofS3 = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence, e2],
        findings: [finding],
        dossiers: [s3, s2, s1],
      }),
      "s3",
    );
    assert.deepEqual(
      ofS3.lineage.map((item) => item.sealId),
      ["s1", "s2", "s3"],
    );
    assert.equal(ofS1.sealId, "s1");
    assert.equal(ofS3.sealId, "s3");
  });

  it("6. names a memory-only change between seals", () => {
    const { goal, evidence, finding } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const s1 = dossierOf({
      id: "s1",
      goalId: goal.id,
      sealedAt: T1,
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
      known: [snapOf(m1)],
      memoryContextHash: "ctx-m1",
    });
    const s2 = dossierOf({
      id: "s2",
      goalId: goal.id,
      sealedAt: T2,
      supersedesId: "s1",
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
      known: [],
      memoryContextHash: "ctx-empty",
    });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m1],
        dossiers: [s2, s1],
      }),
      "s2",
    );
    const step = result.lineage.find((item) => item.sealId === "s2");
    assert.equal(step?.causeFromPrevious, "memory");
    assert.match(step?.changeNote ?? "", /memoria/);
    assert.equal(result.previous?.sealId, "s1");
  });

  it("7. names an evidence-only change between seals", () => {
    const { goal, evidence, finding } = simpleCase();
    const s1 = dossierOf({
      id: "s1",
      goalId: goal.id,
      sealedAt: T1,
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
    });
    const s2 = dossierOf({
      id: "s2",
      goalId: goal.id,
      sealedAt: T2,
      supersedesId: "s1",
      findingIds: [finding.id],
      evidenceIds: [evidence.id, "e2"],
      evidenceHashes: [evidence.contentHash, "hash80eur1234567890ab"],
    });
    const e2 = evidenceOf({
      id: "e2",
      goalId: goal.id,
      contentHash: "hash80eur1234567890ab",
    });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence, e2],
        findings: [finding],
        dossiers: [s2, s1],
      }),
      "s2",
    );
    const step = result.lineage.find((item) => item.sealId === "s2");
    assert.equal(step?.causeFromPrevious, "evidence");
  });

  it("8. reconstructs the contradiction that existed at the seal, not a later one", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf(m1)],
      memoryConsulted: 1,
    };
    const then = contradiction({
      id: "c1",
      kind: "evidence-memory",
      at: T1,
      left: { kind: "evidence", id: evidence.id, label: evidence.title },
      right: { kind: "memory", id: "m1", label: m1.title },
      findingId: finding.id,
    });
    const later = contradiction({
      id: "c2",
      kind: "evidence-evidence",
      at: T4,
      left: { kind: "evidence", id: evidence.id, label: evidence.title },
      right: { kind: "evidence", id: "e2", label: "Otra" },
    });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m1],
        dossiers: [withMemory],
        contradictions: [later, then],
      }),
      seal.id,
    );
    assert.equal(result.contradictions[0]?.kind, "evidence-memory");
    assert.equal(result.contradictions.some((item) => item.id === "c2"), false);
  });

  it("16. an open contradiction at S1 stays open after a later close", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf(m1)],
      memoryConsulted: 1,
    };
    const then = contradiction({
      id: "c1",
      kind: "evidence-memory",
      at: T1,
      open: false,
      closedAt: T3,
      left: { kind: "evidence", id: evidence.id, label: evidence.title },
      right: { kind: "memory", id: "m1", label: m1.title },
      findingId: finding.id,
    });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [{ ...m1, lifecycle: "revoked", closedAt: T3 }],
        dossiers: [withMemory],
        contradictions: [then],
      }),
      seal.id,
    );
    assert.equal(result.contradictions.length, 1);
    assert.equal(result.contradictions[0]?.id, "c1");
    assert.equal(result.contradictions[0]?.open, true);
    assert.equal(result.contradictions[0]?.closedAt, undefined);
  });

  it("17. a later interpretation that names S1 does not enter Replay(S1)", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const s2 = dossierOf({
      id: "d2",
      goalId: goal.id,
      supersedesId: seal.id,
      sealedAt: T3,
      executive: "Con memoria vigente la lectura cambió.",
      findingIds: [finding.id],
      evidenceIds: [evidence.id],
      evidenceHashes: [evidence.contentHash],
    });
    const later = contradiction({
      id: "c-ii",
      kind: "interpretation-interpretation",
      at: T3,
      open: false,
      closedAt: T3,
      sealId: s2.id,
      left: { kind: "seal", id: seal.id, label: seal.executive },
      right: { kind: "seal", id: s2.id, label: s2.executive },
    });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        dossiers: [s2, seal],
        contradictions: [later],
      }),
      seal.id,
    );
    assert.equal(result.contradictions.some((item) => item.id === "c-ii"), false);
    assert.equal(result.contradictions.some((item) => item.kind === "interpretation-interpretation"), false);
  });

  it("9. never imports or calls the network", async () => {
    const src = readFileSync(fileURLToPath(new URL("./replay.ts", import.meta.url)), "utf8");
    assert.equal(/readPublicWeb|searchPublicWeb|interpretEvidence/.test(src), false);
    assert.equal(/from ["'].*research/.test(src), false);
    const { goal, evidence, finding, seal } = simpleCase();
    const calls: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      throw new Error("Replay no consulta la red");
    }) as typeof fetch;
    try {
      const result = replaySeal(
        emptyState({
          goals: [goal],
          evidence: [evidence],
          findings: [finding],
          dossiers: [seal],
        }),
        seal.id,
      );
      assert.equal(result.status, "complete");
      assert.deepEqual(calls, []);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("10. does not mutate the Kernel", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const state = emptyState({
      goals: [goal],
      evidence: [evidence],
      findings: [finding],
      memory: [m1],
      dossiers: [
        {
          ...seal,
          known: [snapOf(m1)],
          memoryConsulted: 1,
        },
      ],
      contradictions: [
        contradiction({
          id: "c1",
          kind: "evidence-memory",
          left: { kind: "evidence", id: evidence.id, label: evidence.title },
          right: { kind: "memory", id: "m1", label: m1.title },
        }),
      ],
    });
    const before = kernelFingerprint(state);
    const frozen = deepFreeze(structuredClone(state));
    const result = replaySeal(frozen, seal.id);
    assert.equal(result.status, "complete");
    assert.equal(kernelFingerprint(frozen), before);
    assert.equal(kernelFingerprint(state), before);
    assert.equal(state.memory[0]?.lifecycle, "admitted");
    assert.equal(state.dossiers[0]?.sealHash, seal.sealHash);
  });

  it("11. is deterministic for the same seal and the same history", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const withMemory: Dossier = { ...seal, known: [snapOf(m1)], memoryConsulted: 1 };
    const state = emptyState({
      goals: [goal],
      evidence: [evidence],
      findings: [finding],
      memory: [m1],
      dossiers: [withMemory],
      memoryDecisions: [
        decision({ id: "md1", memoryId: "m1", from: null, to: "proposed", at: T0 }),
        decision({ id: "md2", memoryId: "m1", to: "admitted", at: T0 }),
      ],
    });
    const a = replaySeal(state, seal.id);
    const b = replaySeal(state, seal.id);
    assert.deepEqual(a, b);
    const shuffled = emptyState({
      goals: [goal],
      evidence: [evidence],
      findings: [finding],
      memory: [m1],
      dossiers: [withMemory],
      memoryDecisions: [...state.memoryDecisions].reverse(),
    });
    const c = replaySeal(shuffled, seal.id);
    assert.deepEqual(c.decisions, a.decisions);
    assert.deepEqual(c.memory, a.memory);
  });

  it("12. reports Historial insuficiente without filling gaps from the present", () => {
    const missingSeal = replaySeal(emptyState(), "d-missing");
    assert.equal(missingSeal.status, "incomplete");
    assert.equal(missingSeal.note, HISTORIAL_INSUFICIENTE);
    assert.equal(missingSeal.missing[0]?.field, "seal");
    assert.equal(missingSeal.memory.length, 0);

    const { goal, finding, seal } = simpleCase();
    const m2 = memoryOf({ id: "m2", title: "Memoria viva posterior", lifecycle: "admitted" });
    const hollow = replaySeal(
      emptyState({
        goals: [goal],
        findings: [finding],
        memory: [m2],
        dossiers: [seal],
      }),
      seal.id,
    );
    assert.equal(hollow.status, "incomplete");
    assert.equal(hollow.note, HISTORIAL_INSUFICIENTE);
    assert.equal(hollow.memory.length, 0);
    assert.equal(hollow.evidence.length, 0);
  });

  it("13. distinguishes historical consult from live admitted memory", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1", lifecycle: "revoked", closedAt: T3 });
    const m2 = memoryOf({ id: "m2", title: "Vigente ahora", admittedAt: T3 });
    const withMemory: Dossier = {
      ...seal,
      known: [snapOf({ ...m1, lifecycle: "admitted" })],
      memoryConsulted: 1,
    };
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m2, m1],
        dossiers: [withMemory],
      }),
      seal.id,
    );
    assert.equal(result.memory[0]?.memoryId, "m1");
    assert.equal(result.memory[0]?.lifecycleAtConsult, "admitted");
    assert.equal(replayUsesMemory(result, "m2"), false);
  });

  it("14. is not reinterpretation with live memory", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const m1 = memoryOf({ id: "m1" });
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        memory: [m1],
        dossiers: [{ ...seal, known: [snapOf(m1)], memoryConsulted: 1 }],
      }),
      seal.id,
    );
    assert.equal(replayIsReinterpretation(result), false);
    assert.equal(replayUsesMemory(result, "m1"), true);
  });

  it("15. reconstructs provenance from the Kernel, not from a generated story", () => {
    const { goal, evidence, finding, seal } = simpleCase();
    const result = replaySeal(
      emptyState({
        goals: [goal],
        evidence: [evidence],
        findings: [finding],
        dossiers: [seal],
      }),
      seal.id,
    );
    assert.deepEqual(result.provenance.findingIds, [finding.id]);
    assert.deepEqual(result.provenance.evidenceIds, [evidence.id]);
    assert.equal(result.provenance.closedBySealId, seal.id);
    assert.equal(result.provenance.closedBySealHash, seal.sealHash);
    assert.equal(result.reconstructed.includes("sello"), true);
  });
});
