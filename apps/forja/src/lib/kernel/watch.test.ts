import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyReread,
  duplicateObservation,
  latestEvidenceByUrl,
  openTensions,
  relatedDossiers,
  watchSummary,
} from "./watch.ts";
import type { Dossier, Evidence, Finding, Goal, MemoryRecord } from "./types.ts";

const evidence = (over: Partial<Evidence> = {}): Evidence => ({
  id: "e1",
  goalId: "g1",
  url: "https://example.com/page",
  title: "Página",
  sourceHost: "example.com",
  excerpt: "Texto observado",
  contentHash: "abc123def4567890",
  retrievedAt: "2026-08-29T00:00:00.000Z",
  httpStatus: 200,
  bytes: 20,
  validation: "retrieved",
  ...over,
});

describe("duplicateObservation", () => {
  it("treats same url and hash on the same case as a duplicate", () => {
    assert.equal(duplicateObservation([evidence()], evidence({ id: "e2" })), true);
  });

  it("allows a later observation of the same url with a new hash", () => {
    assert.equal(
      duplicateObservation(
        [evidence()],
        evidence({ id: "e2", contentHash: "fff123def4567890", retrievedAt: "2026-08-29T01:00:00.000Z" }),
      ),
      false,
    );
  });
});

describe("classifyReread", () => {
  it("marks stable hashes", () => {
    assert.equal(
      classifyReread("abc123def4567890", { ok: true, contentHash: "abc123def4567890" }),
      "stable",
    );
  });

  it("marks changed hashes", () => {
    assert.equal(
      classifyReread("abc123def4567890", { ok: true, contentHash: "fff123def4567890" }),
      "changed",
    );
  });

  it("marks missing and blocked without inventing a hash", () => {
    assert.equal(classifyReread("abc", { ok: false, status: "FAIL" }), "missing");
    assert.equal(classifyReread("abc", { ok: false, status: "BLOCKED" }), "blocked");
  });
});

describe("latestEvidenceByUrl", () => {
  it("keeps the newest observation per url", () => {
    const latest = latestEvidenceByUrl([
      evidence({ id: "old", retrievedAt: "2026-08-29T00:00:00.000Z" }),
      evidence({
        id: "new",
        contentHash: "fff123def4567890",
        retrievedAt: "2026-08-29T02:00:00.000Z",
      }),
    ]);
    assert.equal(latest.length, 1);
    assert.equal(latest[0].id, "new");
  });
});

describe("watchSummary", () => {
  it("names only the counts that happened", () => {
    assert.equal(
      watchSummary({ stable: 3, changed: 1, missing: 0, blocked: 0 }),
      "3 estables · 1 cambió",
    );
  });
});

describe("relatedDossiers", () => {
  const goalA: Goal = {
    id: "g1",
    text: "Hefesto en la mitología griega",
    createdAt: "2026-08-29T00:00:00.000Z",
    updatedAt: "2026-08-29T00:00:00.000Z",
    status: "complete",
    stage: "complete",
    evidenceIds: ["e1"],
    findingIds: ["f1"],
    leadCount: 1,
    leads: [],
    watched: false,
  };
  const goalB: Goal = {
    ...goalA,
    id: "g2",
    text: "Símbolos del herrero Hefesto",
    evidenceIds: ["e2"],
    findingIds: ["f2"],
  };
  const dossier = (goalId: string, executive: string): Dossier => ({
    id: `d-${goalId}`,
    goalId,
    sealedAt: goalA.createdAt,
    sealHash: "abc123def4567890abcd",
    executive,
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
  });
  const finding = (over: Partial<Finding>): Finding => ({
    id: "f1",
    goalId: "g1",
    title: "Dios de la forja",
    answer: "Hefesto es el herrero del Olimpo.",
    whyItMatters: "Identidad",
    confidence: "medium",
    evidenceIds: ["e1"],
    uncertainties: [],
    nextAction: "",
    interpretationAvailable: true,
    createdAt: goalA.createdAt,
    ...over,
  });

  it("does not invent related cases without overlap", () => {
    const hits = relatedDossiers({
      goalId: "g1",
      goalText: goalA.text,
      dossiers: [dossier("g9", "Precios de taladros Bosch en Europa")],
      goals: [goalA, { ...goalA, id: "g9", text: "Taladro barato" }],
      findings: [finding({})],
    });
    assert.equal(hits.length, 0);
  });

  it("links overlapping sealed cases", () => {
    const hits = relatedDossiers({
      goalId: "g1",
      goalText: goalA.text,
      dossiers: [dossier("g2", "Hefesto, dios herrero, trabaja el fuego y el metal.")],
      goals: [goalA, goalB],
      findings: [
        finding({}),
        finding({
          id: "f2",
          goalId: "g2",
          title: "Símbolos",
          answer: "El yunque y el martillo de Hefesto.",
        }),
      ],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].dossier.goalId, "g2");
    assert.equal(hits[0].kind, "related");
  });

  it("does not list two seals of the same other case as two cases", () => {
    const hits = relatedDossiers({
      goalId: "g1",
      goalText: goalA.text,
      dossiers: [
        dossier("g2", "Hefesto, dios herrero, trabaja el fuego y el metal."),
        {
          ...dossier("g2", "Sello anterior de Hefesto."),
          id: "d-g2-old",
          sealedAt: "2026-08-28T00:00:00.000Z",
          sealHash: "old123def4567890abcd",
        },
      ],
      goals: [goalA, goalB],
      findings: [
        finding({}),
        finding({
          id: "f2",
          goalId: "g2",
          title: "Símbolos",
          answer: "El yunque y el martillo de Hefesto.",
        }),
      ],
    });
    assert.equal(hits.length, 1);
    assert.equal(hits[0].dossier.id, "d-g2");
  });

  it("marks tension only when a finding names memory from the other case", () => {
    const memory: MemoryRecord = {
      id: "m1",
      findingId: "f2",
      goalId: "g2",
      title: "Hefesto es mortal",
      why: "Mal leído.",
      evidenceIds: ["e2"],
      admittedAt: goalA.createdAt,
      lifecycle: "admitted",
      informedGoalIds: ["g1"],
    };
    const hits = relatedDossiers({
      goalId: "g1",
      goalText: goalA.text,
      dossiers: [dossier("g2", "Hefesto herrero")],
      goals: [goalA, goalB],
      findings: [
        finding({
          delta: "tension",
          deltaMemoryId: "m1",
          answer: "Hefesto es un dios olímpico, no un mortal.",
        }),
        finding({ id: "f2", goalId: "g2", title: "Mortal", answer: "Una ficha lo llama mortal." }),
      ],
      memory: [memory],
    });
    assert.equal(hits[0]?.kind, "tension");
  });

  it("shows reverse tension on the case that owns the memory", () => {
    const memory: MemoryRecord = {
      id: "m1",
      findingId: "f1",
      goalId: "g1",
      title: "Hefesto es un dios olímpico",
      why: "Admitido tras el primer caso.",
      evidenceIds: ["e1"],
      admittedAt: goalA.createdAt,
      lifecycle: "admitted",
      informedGoalIds: ["g2"],
    };
    const hits = relatedDossiers({
      goalId: "g1",
      goalText: goalA.text,
      dossiers: [dossier("g2", "Una ficha llama mortal a Hefesto.")],
      goals: [goalA, goalB],
      findings: [
        finding({}),
        finding({
          id: "f2",
          goalId: "g2",
          title: "Mortal",
          answer: "Una ficha lo llama mortal.",
          delta: "tension",
          deltaMemoryId: "m1",
          deltaNote: "Contradice la memoria admitida del caso anterior.",
        }),
      ],
      memory: [memory],
    });
    assert.equal(hits[0]?.kind, "tension");
    assert.match(hits[0]?.note ?? "", /aquel caso tensiona memoria de este/);
  });
});

describe("openTensions", () => {
  it("ignores tension against a case's own memory", () => {
    const rows = openTensions({
      findings: [
        {
          id: "f1",
          goalId: "g1",
          title: "Conflicto interno",
          answer: "No debería listarse.",
          whyItMatters: "",
          confidence: "low",
          evidenceIds: ["e1"],
          uncertainties: [],
          nextAction: "",
          interpretationAvailable: true,
          createdAt: "2026-08-29T00:00:00.000Z",
          delta: "tension",
          deltaMemoryId: "m1",
        },
      ],
      memory: [
        {
          id: "m1",
          findingId: "f0",
          goalId: "g1",
          title: "Misma casa",
          why: "Propia.",
          evidenceIds: ["e1"],
          admittedAt: "2026-08-29T00:00:00.000Z",
          lifecycle: "admitted",
          informedGoalIds: [],
        },
      ],
      goals: [
        {
          id: "g1",
          text: "Caso único",
          createdAt: "2026-08-29T00:00:00.000Z",
          updatedAt: "2026-08-29T00:00:00.000Z",
          status: "complete",
          stage: "complete",
          evidenceIds: ["e1"],
          findingIds: ["f1"],
          leadCount: 0,
          leads: [],
          watched: false,
        },
      ],
    });
    assert.equal(rows.length, 0);
  });

  it("lists a later finding that tensions another case's memory", () => {
    const rows = openTensions({
      findings: [
        {
          id: "f2",
          goalId: "g2",
          title: "Hefesto no es mortal",
          answer: "Las fuentes lo tratan como dios olímpico.",
          whyItMatters: "",
          confidence: "medium",
          evidenceIds: ["e2"],
          uncertainties: [],
          nextAction: "",
          interpretationAvailable: true,
          createdAt: "2026-08-29T01:00:00.000Z",
          delta: "tension",
          deltaNote: "Contradice la memoria del caso anterior.",
          deltaMemoryId: "m1",
        },
      ],
      memory: [
        {
          id: "m1",
          findingId: "f1",
          goalId: "g1",
          title: "Hefesto es mortal",
          why: "Mal leído.",
          evidenceIds: ["e1"],
          admittedAt: "2026-08-29T00:00:00.000Z",
          lifecycle: "admitted",
          informedGoalIds: ["g2"],
        },
      ],
      goals: [
        {
          id: "g1",
          text: "Hefesto mitología",
          createdAt: "2026-08-29T00:00:00.000Z",
          updatedAt: "2026-08-29T00:00:00.000Z",
          status: "complete",
          stage: "complete",
          evidenceIds: ["e1"],
          findingIds: ["f1"],
          leadCount: 0,
          leads: [],
          watched: false,
        },
        {
          id: "g2",
          text: "¿Hefesto era mortal?",
          createdAt: "2026-08-29T01:00:00.000Z",
          updatedAt: "2026-08-29T01:00:00.000Z",
          status: "complete",
          stage: "complete",
          evidenceIds: ["e2"],
          findingIds: ["f2"],
          leadCount: 0,
          leads: [],
          watched: false,
        },
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].fromGoalId, "g2");
    assert.equal(rows[0].toGoalId, "g1");
    assert.equal(rows[0].memoryId, "m1");
  });

  it("drops the tension when that memory leaves the kernel", () => {
    const finding: Finding = {
      id: "f2",
      goalId: "g2",
      title: "Hefesto no es mortal",
      answer: "Las fuentes lo tratan como dios olímpico.",
      whyItMatters: "",
      confidence: "medium",
      evidenceIds: ["e2"],
      uncertainties: [],
      nextAction: "",
      interpretationAvailable: true,
      createdAt: "2026-08-29T01:00:00.000Z",
      delta: "tension",
      deltaMemoryId: "m1",
    };
    const goals: Goal[] = [
      {
        id: "g1",
        text: "A",
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
        status: "complete",
        stage: "complete",
        evidenceIds: [],
        findingIds: [],
        leadCount: 0,
        leads: [],
        watched: false,
      },
      {
        id: "g2",
        text: "B",
        createdAt: "2026-08-29T00:00:00.000Z",
        updatedAt: "2026-08-29T00:00:00.000Z",
        status: "complete",
        stage: "complete",
        evidenceIds: [],
        findingIds: [],
        leadCount: 0,
        leads: [],
        watched: false,
      },
    ];
    const memory: MemoryRecord[] = [
      {
        id: "m1",
        findingId: "f1",
        goalId: "g1",
        title: "Hefesto es mortal",
        why: "Mal leído.",
        evidenceIds: ["e1"],
        admittedAt: "2026-08-29T00:00:00.000Z",
        lifecycle: "admitted",
        informedGoalIds: ["g2"],
      },
    ];
    assert.equal(openTensions({ findings: [finding], memory, goals }).length, 1);
    assert.equal(openTensions({ findings: [finding], memory: [], goals }).length, 0);
  });
});
