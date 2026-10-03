import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { admitDossier } from "./admission.ts";
import {
  composeDossier,
  composeExecutive,
  compareSeals,
  childrenOf,
  chooseInstrument,
  commitSeal,
  currentSeal,
  dossierToMarkdown,
  hashMemoryContext,
  latestDossierByGoal,
  parentSealContext,
  memoryConsultNote,
  memoryConsultIsStale,
  newSourcesNotInSeal,
  changedSealedSources,
  sealedEvidence,
  sealedPlusNewEvidence,
  sealChangeNote,
  sealIsStale,
  sealLineage,
  spawnedFromDossier,
  snapshotRelatedMemory,
  uncoveredEvidence,
} from "./dossier.ts";

import type { Dossier, Evidence, Finding, Goal, KnownMemorySnapshot, MemoryRecord } from "./types.ts";


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
  uncertainties: ["Una sola fuente"],
  nextAction: "Comparar otra tienda",
  interpretationAvailable: true,
  createdAt: evidence.retrievedAt,
  delta: "novel",
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

function knownSnap(
  over: Partial<KnownMemorySnapshot> & Pick<KnownMemorySnapshot, "memoryId" | "title">,
): KnownMemorySnapshot {
  return {
    findingId: memory.findingId,
    goalId: memory.goalId,
    admittedAt: memory.admittedAt,
    lifecycle: "admitted",
    whyHash: "whyhash1234567890abcd",
    consultedAt: evidence.retrievedAt,
    ...over,
  };
}

function dossierStub(over: Partial<Dossier> = {}): Dossier {
  return {
    id: "d1",
    goalId: "g1",
    sealedAt: evidence.retrievedAt,
    sealHash: "abc123def4567890abcd",
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
    ...over,
  };
}


describe("composeExecutive", () => {
  it("uses the finding answer and never invents a second voice", () => {
    assert.equal(composeExecutive([finding]), "Hay un taladro a 20 EUR.");
  });

  it("returns empty without findings", () => {
    assert.equal(composeExecutive([]), "");
  });

  it("uses only the newest findings when a case accumulates watches", () => {
    const older: Finding = {
      ...finding,
      id: "f0",
      title: "Viejo",
      answer: "Esto no debería aparecer en la síntesis.",
      createdAt: "2026-08-28T00:00:00.000Z",
    };
    const text = composeExecutive([
      older,
      finding,
      { ...finding, id: "f2", title: "Dos", answer: "Segundo.", createdAt: "2026-08-29T02:00:00.000Z" },
      { ...finding, id: "f3", title: "Tres", answer: "Tercero.", createdAt: "2026-08-29T03:00:00.000Z" },
    ]);
    assert.doesNotMatch(text, /no debería aparecer/);
    assert.match(text, /Tercero/);
  });
});

describe("composeDossier", () => {
  it("refuses to seal without evidence", async () => {
    const result = await composeDossier({
      goal,
      findings: [finding],
      evidence: [],
      related: [],
    });
    assert.equal(result, null);
  });

  it("seals a hash over evidence and findings", async () => {
    const dossier = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(dossier);
    assert.equal(dossier.executive, finding.answer);
    assert.equal(dossier.known[0]?.memoryId, "m1");
    assert.equal(dossier.known[0]?.findingId, "f0");
    assert.equal(dossier.known[0]?.lifecycle, "admitted");
    assert.ok(dossier.known[0]?.whyHash);
    assert.equal(dossier.known[0]?.whyHash.length, 64);
    assert.equal(dossier.memoryContextHash.length, 64);
    assert.deepEqual(dossier.novel, ["Precio observado"]);

    assert.equal(dossier.sealHash.length, 64);
    assert.match(dossier.sealHash, /^[a-f0-9]+$/);
  });

  it("seals only the three newest findings", async () => {
    const extras: Finding[] = [4, 3, 2, 1, 0].map((n) => ({
      ...finding,
      id: `f${n}`,
      title: `Hallazgo ${n}`,
      answer: `Respuesta ${n}.`,
      createdAt: `2026-08-2${n}T00:00:00.000Z`,
    }));
    const dossier = await composeDossier({
      goal,
      findings: extras,
      evidence: [evidence],
      related: [],
    });
    assert.ok(dossier);
    assert.deepEqual(dossier.findingIds, ["f4", "f3", "f2"]);
    assert.doesNotMatch(dossier.executive, /Respuesta 0/);
    assert.doesNotMatch(dossier.executive, /Respuesta 1/);
  });
});

describe("latestDossierByGoal", () => {
  it("keeps only the newest seal per case", () => {
    const older: Dossier = {
      id: "d-old",
      goalId: "g1",
      sealedAt: "2026-08-29T00:00:00.000Z",
      sealHash: "aaa123def4567890abcd",
      executive: "Viejo",
      known: [],
      memoryContextHash: "",
      novel: [],
      confirmed: [],
      tensions: [],
      uncertain: [],
      next: "",
      findingIds: ["f1"],
      evidenceIds: ["e1"],
      evidenceHashes: ["h1"],
      sourceHosts: ["example.com"],
      interpretationAvailable: true,
      memoryConsulted: 0,
      reusedCount: 0,
    };
    const newer: Dossier = {
      ...older,
      id: "d-new",
      sealedAt: "2026-08-29T02:00:00.000Z",
      sealHash: "bbb123def4567890abcd",
      executive: "Nuevo",
      supersedesId: "d-old",
    };
    const latest = latestDossierByGoal([older, newer, { ...older, id: "d2", goalId: "g2" }]);
    assert.equal(latest.length, 2);
    assert.equal(latest.find((item) => item.goalId === "g1")?.id, "d-new");
  });
});

describe("compareSeals", () => {
  const base: Dossier = {
    id: "d1",
    goalId: "g1",
    sealedAt: evidence.retrievedAt,
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
    evidenceHashes: ["h1"],
    sourceHosts: ["example.com"],
    interpretationAvailable: true,
    memoryConsulted: 0,
    reusedCount: 0,
  };

  it("names a hash change without rewriting the executive", () => {
    const newer = { ...base, id: "d2", evidenceHashes: ["h2"], executive: base.executive };
    const diff = compareSeals(newer, base);
    assert.equal(diff.hashesChanged, true);
    assert.equal(diff.executiveChanged, false);
    assert.match(sealChangeNote(newer, base), /huella/);
  });

  it("names incorporated sources without pretending the old ones changed", () => {
    const newer = {
      ...base,
      id: "d2",
      evidenceHashes: ["h1", "h2"],
      evidenceIds: ["e1", "e2"],
    };
    const diff = compareSeals(newer, base);
    assert.equal(diff.added, 1);
    assert.equal(diff.removed, 0);
    assert.match(sealChangeNote(newer, base), /incorporaron/);
  });

  it("names a memory consult change without pretending the sources moved", () => {
    const newer = {
      ...base,
      id: "d2",
      known: [knownSnap({ memoryId: "m1", title: "Taladro Bosch de 20 euros" })],
      memoryContextHash: "ctx123def4567890abcd",
    };

    const diff = compareSeals(newer, base);
    assert.equal(diff.knownChanged, true);
    assert.equal(diff.hashesChanged, false);
    assert.match(sealChangeNote(newer, base), /memoria consultada/);
  });
});

describe("spawnedFromDossier", () => {
  it("returns the case opened from a dossier next action", () => {
    const child: Goal = { ...goal, id: "g2", spawnedFromDossierId: "d1", spawnedFromGoalId: "g1" };
    assert.equal(spawnedFromDossier([goal, child], "d1")?.id, "g2");
    assert.equal(spawnedFromDossier([goal, child], "other"), undefined);
  });
});

describe("childrenOf", () => {
  it("lists cases spawned from a parent", () => {
    const child: Goal = { ...goal, id: "g2", spawnedFromGoalId: "g1" };
    assert.equal(childrenOf([goal, child], "g1")[0]?.id, "g2");
    assert.equal(childrenOf([goal, child], "g2").length, 0);
  });
});

describe("sealIsStale", () => {
  it("is stale when retrieved evidence is not in the seal", () => {
    const extra: Evidence = { ...evidence, id: "e2", contentHash: "otherhash12345678" };
    const dossier = {
      id: "d1",
      goalId: "g1",
      sealedAt: evidence.retrievedAt,
      sealHash: "abc123def4567890abcd",
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
    assert.equal(sealIsStale(dossier, [evidence]), false);
    assert.equal(sealIsStale(dossier, [evidence, extra]), true);
    assert.equal(uncoveredEvidence(dossier, [evidence, extra])[0]?.id, "e2");
  });
});

describe("memoryConsultNote", () => {
  const dossier: Dossier = {
    id: "d1",
    goalId: "g2",
    sealedAt: evidence.retrievedAt,
    sealHash: "abc123def4567890abcd",
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

  it("is silent when known and related memory match", () => {
    const related = [{ memory, score: 0.4, overlap: 2 }];
    const sealed = { ...dossier, known: [knownSnap({ memoryId: memory.id, title: memory.title })] };
    assert.equal(memoryConsultNote(sealed, related, [memory]), null);
    assert.equal(memoryConsultIsStale(sealed, related, [memory]), false);
  });

  it("names memory the seal never consulted", () => {
    const related = [{ memory, score: 0.4, overlap: 2 }];
    const note = memoryConsultNote(dossier, related, [memory]);
    assert.match(note ?? "", /no consultó/);
  });

  it("names memory the seal consulted that left the kernel", () => {
    const sealed = { ...dossier, known: [knownSnap({ memoryId: "m1", title: "Taladro Bosch de 20 euros" })] };
    const note = memoryConsultNote(sealed, [], []);
    assert.match(note ?? "", /histórica/);
    assert.match(note ?? "", /no está vigente/);
  });
});

describe("parentSealContext", () => {
  it("is absent unless the case was spawned from a sealed dossier", () => {
    assert.equal(parentSealContext(goal, [], [finding], [goal]), undefined);
  });

  it("returns the parent seal, not memory", () => {
    const parentDossier: Dossier = {
      id: "d-parent",
      goalId: "g1",
      sealedAt: evidence.retrievedAt,
      sealHash: "abc123def4567890abcd",
      executive: finding.answer,
      known: [],
      memoryContextHash: "",
      novel: [],
      confirmed: [],
      tensions: [],
      uncertain: [],
      next: "Comparar otra tienda",
      findingIds: ["f1"],
      evidenceIds: ["e1"],
      evidenceHashes: [evidence.contentHash],
      sourceHosts: ["example.com"],
      interpretationAvailable: true,
      memoryConsulted: 0,
      reusedCount: 0,
    };
    const child: Goal = {
      ...goal,
      id: "g2",
      text: "Comparar otra tienda",
      spawnedFromGoalId: "g1",
      spawnedFromDossierId: "d-parent",
    };
    const ctx = parentSealContext(child, [parentDossier], [finding], [goal, child]);
    assert.ok(ctx);
    assert.equal(ctx.goal, goal.text);
    assert.equal(ctx.executive, finding.answer);
    assert.equal(ctx.findings[0]?.title, finding.title);
  });
});

describe("admitDossier", () => {
  const base: Dossier = {
    id: "d1",
    goalId: "g1",
    sealedAt: evidence.retrievedAt,
    sealHash: "abc123def4567890",
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

  it("blocks a dossier citing foreign evidence", () => {
    const result = admitDossier(
      { ...base, evidenceIds: ["missing"] },
      [finding],
      [evidence],
      [],
      goal.text,
    );
    assert.equal(result.ok, false);
  });

  it("admits a sealed case file bound to kernel records", () => {
    const result = admitDossier(base, [finding], [evidence], [], goal.text);
    assert.equal(result.ok, true);
  });
});

describe("dossierToMarkdown", () => {
  it("includes seal, sources and hashes — never invents urls", async () => {
    const dossier = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(dossier);
    const md = dossierToMarkdown(dossier, goal, [finding], [evidence], [memory]);
    assert.match(md, /Taladro 18-25 euros/);
    assert.match(md, /https:\/\/example.com\/drill/);
    assert.match(md, /abc123def4567890abcd/);
    assert.ok(md.includes(dossier.sealHash));
    assert.match(md, /Taladro Bosch de 20 euros/);
    assert.doesNotMatch(md, /sparkle|✨/i);
  });

  it("labels forgotten memory as historical without using live why as evidence", async () => {
    const dossier = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(dossier);
    const md = dossierToMarkdown(dossier, goal, [finding], [evidence], []);
    assert.match(md, /Taladro Bosch de 20 euros/);
    assert.match(md, /memoria histórica, ya no vigente/);
    assert.doesNotMatch(md, /Precio verificado/);
  });
});

describe("memory snapshot", () => {
  it("freezes consulted memory identity, authority and why fingerprint", async () => {
    const snap = await snapshotRelatedMemory(
      [{ memory, score: 0.4, overlap: 2 }],
      "2026-08-29T04:00:00.000Z",
    );
    assert.equal(snap[0]?.memoryId, "m1");
    assert.equal(snap[0]?.findingId, "f0");
    assert.equal(snap[0]?.goalId, "g0");
    assert.equal(snap[0]?.lifecycle, "admitted");
    assert.equal(snap[0]?.consultedAt, "2026-08-29T04:00:00.000Z");
    assert.equal(snap[0]?.whyHash.length, 64);
    assert.notEqual(snap[0]?.whyHash, memory.why);
  });

  it("changes the seal hash when the same memory id has a different why", async () => {
    const a = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    const b = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [
        {
          memory: { ...memory, why: "Otra razón del operador, distinta." },
          score: 0.4,
          overlap: 2,
        },
      ],
    });
    assert.ok(a && b);
    assert.deepEqual(a.evidenceHashes, b.evidenceHashes);
    assert.equal(a.known[0]?.memoryId, b.known[0]?.memoryId);
    assert.notEqual(a.known[0]?.whyHash, b.known[0]?.whyHash);
    assert.notEqual(a.memoryContextHash, b.memoryContextHash);
    assert.notEqual(a.sealHash, b.sealHash);
  });

  it("does not put memory identifiers into evidence ids", async () => {
    const dossier = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(dossier);
    assert.equal(dossier.evidenceIds.includes("m1"), false);
    assert.equal(dossier.known.some((item) => item.memoryId === "e1"), false);
    const ctx = await hashMemoryContext(dossier.known);
    assert.equal(ctx, dossier.memoryContextHash);
  });
});

describe("chooseInstrument", () => {
  const sealed = dossierStub();

  it("picks INCORPORAR for a new source url", () => {
    const extra: Evidence = {
      ...evidence,
      id: "e2",
      url: "https://example.org/other",
      contentHash: "otherhash12345678",
    };
    assert.equal(chooseInstrument(sealed, [evidence, extra], [], []), "INCORPORAR");
    assert.equal(newSourcesNotInSeal(sealed, [evidence, extra])[0]?.id, "e2");
    assert.equal(changedSealedSources(sealed, [evidence, extra]).length, 0);
  });

  it("picks RELEER when a sealed url changed hash, not INCORPORAR", () => {
    const reread: Evidence = {
      ...evidence,
      id: "e2",
      contentHash: "newhash1234567890",
      retrievedAt: "2026-08-29T03:00:00.000Z",
    };
    assert.equal(chooseInstrument(sealed, [evidence, reread], [], []), "RELEER");
    assert.equal(newSourcesNotInSeal(sealed, [evidence, reread]).length, 0);
    assert.equal(changedSealedSources(sealed, [evidence, reread])[0]?.id, "e2");
  });

  it("picks REINTERPRETAR when evidence hashes match and memory context changed", () => {
    const withKnown = {
      ...sealed,
      known: [knownSnap({ memoryId: "m1", title: memory.title })],
      memoryContextHash: "ctx-old-1234567890ab",
    };
    const related = [{ memory, score: 0.4, overlap: 2 }];
    assert.equal(chooseInstrument(withKnown, [evidence], related, [memory]), "NADA");
    assert.equal(chooseInstrument(withKnown, [evidence], related, []), "REINTERPRETAR");
    const later = { ...memory, id: "m2", title: "Taladro visto después", why: "Otra memoria admitida luego." };
    assert.equal(
      chooseInstrument(withKnown, [evidence], [{ memory: later, score: 0.5, overlap: 2 }], [later]),
      "REINTERPRETAR",
    );
  });

  it("does not pick RELEER when only memory changed", () => {
    const withKnown = {
      ...sealed,
      known: [knownSnap({ memoryId: "m-old", title: "Vieja" })],
    };
    const instrument = chooseInstrument(
      withKnown,
      [evidence],
      [{ memory, score: 0.4, overlap: 2 }],
      [memory],
    );
    assert.equal(instrument, "REINTERPRETAR");
    assert.equal(changedSealedSources(withKnown, [evidence]).length, 0);
  });

  it("same evidence hashes and different memory context is REINTERPRETAR, never RELEER", async () => {
    const first = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(first);
    const later = {
      ...memory,
      id: "m2",
      title: "Taladro visto después",
      why: "Otra memoria admitida luego.",
    };
    const second = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [{ memory: later, score: 0.5, overlap: 2 }],
    });
    assert.ok(second);
    assert.deepEqual([...first.evidenceHashes].sort(), [...second.evidenceHashes].sort());
    assert.notEqual(first.memoryContextHash, second.memoryContextHash);
    assert.notEqual(first.sealHash, second.sealHash);
    assert.equal(
      chooseInstrument(
        first,
        [evidence],
        [{ memory: later, score: 0.5, overlap: 2 }],
        [later],
      ),
      "REINTERPRETAR",
    );
  });
});

describe("sealedPlusNewEvidence", () => {
  it("keeps the sealed observation instead of a later hash of the same url", () => {
    const later: Evidence = {
      ...evidence,
      id: "e2",
      contentHash: "newhash1234567890",
      retrievedAt: "2026-08-29T03:00:00.000Z",
    };
    const extra: Evidence = {
      ...evidence,
      id: "e3",
      url: "https://example.org/other",
      contentHash: "otherhash12345678",
    };
    const sealed = dossierStub();
    const corpus = sealedPlusNewEvidence(sealed, [evidence, later, extra]);
    assert.deepEqual(
      corpus.map((item) => item.id),
      ["e1", "e3"],
    );
    assert.equal(
      sealedEvidence(sealed, [evidence, later, extra])[0]?.contentHash,
      evidence.contentHash,
    );
  });
});

describe("commitSeal", () => {
  it("keeps the previous seal intact and points the new one at it", () => {
    const first = dossierStub({ id: "d1", sealHash: "aaa123def4567890abcd" });
    const frozen = structuredClone(first);
    const second = dossierStub({
      id: "d2",
      sealHash: "bbb123def4567890abcd",
      sealedAt: "2026-08-29T02:00:00.000Z",
      executive: "Nueva lectura",
    });
    const next = commitSeal([first], second);
    assert.equal(next.length, 2);
    assert.equal(next[0]?.id, "d2");
    assert.equal(next[0]?.supersedesId, "d1");
    assert.deepEqual(
      next.find((item) => item.id === "d1"),
      frozen,
    );
  });

  it("keeps the full chain across many reseals with no truncation", () => {
    let dossiers: Dossier[] = [];
    for (let i = 1; i <= 8; i += 1) {
      dossiers = commitSeal(
        dossiers,
        dossierStub({
          id: `d${i}`,
          sealHash: `hash${i}234567890abcdef`,
          sealedAt: `2026-08-29T0${i}:00:00.000Z`,
          executive: `Síntesis ${i}`,
        }),
      );
    }
    assert.equal(dossiers.length, 8);
    const newest = dossiers[0];
    const chain = sealLineage(dossiers, newest);
    assert.equal(chain.length, 8);
    assert.deepEqual(
      chain.map((item) => item.id),
      ["d8", "d7", "d6", "d5", "d4", "d3", "d2", "d1"],
    );
    assert.equal(chain[0]?.supersedesId, "d7");
    assert.equal(chain[7]?.supersedesId, undefined);
    const first = dossiers.find((item) => item.id === "d1");
    assert.equal(first?.executive, "Síntesis 1");
    assert.equal(first?.sealHash, "hash1234567890abcdef");
  });

  it("does not mutate a historical seal object", () => {
    const first = dossierStub({ id: "d1", sealHash: "aaa123def4567890abcd", executive: "Original" });
    const snapshot = structuredClone(first);
    const next = commitSeal(
      [first],
      dossierStub({ id: "d2", sealHash: "bbb123def4567890abcd", executive: "Nuevo" }),
    );
    assert.deepEqual(
      next.find((item) => item.id === "d1"),
      snapshot,
    );
    assert.equal(first.executive, "Original");
    assert.equal(first.supersedesId, undefined);
    assert.equal(next[0]?.executive, "Nuevo");
    assert.equal(next[0]?.supersedesId, "d1");
  });

  it("skips an identical seal hash instead of replacing history", () => {
    const first = dossierStub({ id: "d1", sealHash: "aaa123def4567890abcd" });
    const again = dossierStub({ id: "d2", sealHash: "aaa123def4567890abcd" });
    const next = commitSeal([first], again);
    assert.equal(next.length, 1);
    assert.equal(next[0]?.id, "d1");
  });

  it("chains reseals that share a timestamp by supersedesId, not by clock", () => {
    const stamp = "2026-08-29T09:00:00.000Z";
    let dossiers: Dossier[] = [];
    for (let i = 1; i <= 6; i += 1) {
      dossiers = commitSeal(
        dossiers,
        dossierStub({
          id: `d${i}`,
          sealHash: `hash${i}234567890abcdef`,
          sealedAt: stamp,
          executive: `Síntesis ${i}`,
        }),
      );
    }
    assert.equal(dossiers.length, 6);
    const chain = sealLineage(dossiers, currentSeal(dossiers, "g1")!);
    assert.equal(chain.length, 6);
    assert.deepEqual(
      chain.map((item) => item.id),
      ["d6", "d5", "d4", "d3", "d2", "d1"],
    );
  });
});
