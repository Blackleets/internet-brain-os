import assert from "node:assert/strict";
import { describe, it } from "node:test";


import {
  chooseInstrument,
  compareSeals,
  composeDossier,
  memoryConsultNote,
  sealCause,
  sealChangeNote,
  sealLineage,
  sealsForGoal,
} from "../kernel/dossier.ts";
import { relatedMemory } from "../kernel/related-memory.ts";
import { admittedMemory } from "../kernel/authority.ts";
import { useKernel } from "../kernel/store.ts";
import { itIsolated as itSerial } from "../kernel/test-isolate.ts";
import type { Evidence, Finding, MemoryRecord } from "../kernel/types.ts";
import type { PublicReadResult, ResearchIO } from "./io.ts";
import { incorporateUncovered, reinterpretWithMemory } from "./run-investigation.ts";
import { runWatch } from "./run-watch.ts";

const AT = "2026-08-29T00:00:00.000Z";





type TrackingIO = ResearchIO & { reads: string[]; searches: number; interprets: number };

function trackingIO(over: {
  read?: (url: string) => Promise<PublicReadResult>;
  forbidRead?: boolean;
} = {}): TrackingIO {
  const reads: string[] = [];
  let searches = 0;
  let interprets = 0;
  const io: TrackingIO = {
    reads,
    get searches() {
      return searches;
    },
    get interprets() {
      return interprets;
    },
    searchPublicWeb: async () => {
      searches += 1;
      return { ok: true, hits: [], provider: "test" };
    },
    readPublicWeb: async ({ data }) => {
      reads.push(data.url);
      if (over.forbidRead) {
        throw new Error("readPublicWeb no debe ejecutarse");
      }
      if (over.read) return over.read(data.url);
      return {
        ok: true,
        url: data.url,
        title: "Ficha",
        sourceHost: "example.com",
        excerpt: "Texto observado de la ficha pública para la prueba.",
        contentHash: "samehash1234567890ab",
        httpStatus: 200,
        bytes: 48,
        retrievedAt: "2026-08-29T08:00:00.000Z",
      };
    },
    interpretEvidence: async ({ data }) => {
      interprets += 1;
      return {
        ok: true,
        available: true,
        findings: [
          {
            title: `Lectura (${data.memory?.length ?? 0} memoria)`,
            answer: `Síntesis con ${data.evidence.length} fuente(s). Memoria: ${
              data.memory?.map((item) => item.title).join(", ") || "ninguna"
            }.`,
            whyItMatters: "La prueba verifica el instrumento, no el modelo.",
            confidence: "medium",
            evidenceIndexes: data.evidence.map((_, index) => index),
            uncertainties: ["Interpretación de prueba"],
            nextAction: "Inspeccionar el sello",
          },
        ],
      };
    },
  };
  return io;
}


function evidenceOf(goalId: string, over: Partial<Evidence> = {}): Evidence {
  return {
    id: `e_${goalId}`,
    goalId,
    url: "https://example.com/drill",
    title: "Taladro 20 EUR",
    sourceHost: "example.com",
    excerpt: "Taladro 20 EUR observado en ficha pública de ferretería.",
    contentHash: "abc123def4567890abcd",
    retrievedAt: AT,
    httpStatus: 200,
    bytes: 64,
    validation: "retrieved",
    ...over,
  };
}

function findingOf(goalId: string, evidenceId: string, over: Partial<Finding> = {}): Finding {
  return {
    id: `f_${goalId}`,
    goalId,
    title: "Precio observado",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango pedido.",
    confidence: "medium",
    evidenceIds: [evidenceId],
    uncertainties: ["Una sola fuente"],
    nextAction: "Comparar otra tienda",
    interpretationAvailable: true,
    createdAt: AT,
    ...over,
  };
}

async function seedSealedCase(text: string, related: { memory: MemoryRecord; score: number; overlap: number }[] = []) {
  const kernel = useKernel.getState();
  const goal = kernel.createGoal(text);
  const evidence = evidenceOf(goal.id);
  const finding = findingOf(goal.id, evidence.id);
  assert.equal(kernel.tryAdmitEvidence(evidence).ok, true);
  assert.equal(kernel.tryAdmitFinding(finding).ok, true);
  const live = useKernel.getState().goals.find((item) => item.id === goal.id);
  assert.ok(live);
  const dossier = await composeDossier({
    goal: live,
    findings: [finding],
    evidence: [evidence],
    related,
  });
  assert.ok(dossier);
  assert.equal(kernel.sealDossier(dossier).ok, true);
  return { goalId: goal.id, evidence, finding, dossier };
}

async function seedMemoryCase() {
  const kernel = useKernel.getState();
  const goal = kernel.createGoal("Taladro Bosch de 20 euros");
  const evidence = evidenceOf(goal.id, {
    id: `e_mem_${goal.id}`,
    url: "https://example.net/bosch",
    contentHash: "memhash1234567890abcd",
  });
  const finding = findingOf(goal.id, evidence.id, {
    id: `f_mem_${goal.id}`,
    title: "Taladro Bosch de 20 euros",
    answer: "Una ficha pública lista un taladro Bosch alrededor de 20 euros.",
  });
  assert.equal(kernel.tryAdmitEvidence(evidence).ok, true);
  assert.equal(kernel.tryAdmitFinding(finding).ok, true);
  assert.equal(
    kernel.admitFindingToMemory(finding.id, "Precio verificado en una ficha pública.").ok,
    true,
  );
  const memory = useKernel.getState().memory.find((item) => item.findingId === finding.id);
  assert.ok(memory);
  return { goalId: goal.id, evidence, finding, memory };
}

describe("research operations isolation", { concurrency: false }, () => {

describe("incorporateUncovered", { concurrency: false }, () => {

itSerial("does not call readPublicWeb and leaves the previous seal intact", async () => {
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros");
    const kernel = useKernel.getState();
    const extra = evidenceOf(seeded.goalId, {
      id: `e_extra_${seeded.goalId}`,
      url: "https://example.org/other-drill",
      title: "Otra ficha",
      sourceHost: "example.org",
      contentHash: "otherhash1234567890ab",
      retrievedAt: "2026-08-29T03:00:00.000Z",
    });
    assert.equal(kernel.tryAdmitEvidence(extra).ok, true);
    const io = trackingIO({ forbidRead: true });
    const result = await incorporateUncovered(seeded.goalId, io);
    assert.equal(result.status, "incorporated");
    assert.equal(io.reads.length, 0);
    assert.equal(io.searches, 0);
    assert.equal(io.interprets, 1);
    const seals = sealsForGoal(useKernel.getState().dossiers, seeded.goalId);
    assert.equal(seals.length, 2);
    assert.equal(seals[0]?.supersedesId, seeded.dossier.id);
    const previous = seals.find((item) => item.id === seeded.dossier.id);

    assert.equal(previous?.sealHash, seeded.dossier.sealHash);
    assert.deepEqual(previous?.evidenceIds, seeded.dossier.evidenceIds);
    assert.ok(seals[0]?.evidenceIds.includes(extra.id));
    assert.ok(seals[0]?.evidenceIds.includes(seeded.evidence.id));
    assert.match(sealChangeNote(seals[0]!, previous!), /incorporaron/);
  });

itSerial("does not substitute a later hash of a sealed url", async () => {
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros");
    const kernel = useKernel.getState();
    const reread = evidenceOf(seeded.goalId, {
      id: `e_reread_${seeded.goalId}`,
      contentHash: "newhash1234567890abcd",
      retrievedAt: "2026-08-29T04:00:00.000Z",
    });
    const extra = evidenceOf(seeded.goalId, {
      id: `e_extra_${seeded.goalId}`,
      url: "https://example.org/other-drill",
      sourceHost: "example.org",
      contentHash: "otherhash1234567890ab",
      retrievedAt: "2026-08-29T03:00:00.000Z",
    });
    assert.equal(kernel.tryAdmitEvidence(reread).ok, true);
    assert.equal(kernel.tryAdmitEvidence(extra).ok, true);
    const io = trackingIO({ forbidRead: true });
    const result = await incorporateUncovered(seeded.goalId, io);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") assert.match(result.reason, /Releer/);
    assert.equal(io.reads.length, 0);
  });
});

describe("runWatch", { concurrency: false }, () => {

itSerial("does fetch when a sealed source may have changed", async () => {
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros");
    const io = trackingIO({
      read: async (url) => ({
        ok: true,
        url,
        title: "Taladro 22 EUR",
        sourceHost: "example.com",
        excerpt: "El precio ahora es 22 EUR en la ficha pública observada.",
        contentHash: "zzz123def4567890abcd",
        httpStatus: 200,
        bytes: 60,
        retrievedAt: "2026-08-29T08:00:00.000Z",
      }),
    });
    const result = await runWatch(seeded.goalId, io);
    assert.equal(result.status, "changed");
    assert.equal(io.reads.length, 1);
    assert.equal(io.reads[0], seeded.evidence.url);
    assert.equal(io.searches, 0);
    assert.equal(io.interprets, 1);

    const after = useKernel.getState();
    assert.ok(after.evidence.some((item) => item.contentHash === "zzz123def4567890abcd"));
    const seals = sealsForGoal(after.dossiers, seeded.goalId);
    assert.equal(seals.length, 2);
    assert.equal(seals[0]?.supersedesId, seeded.dossier.id);
    assert.equal(seals.find((item) => item.id === seeded.dossier.id)?.sealHash, seeded.dossier.sealHash);
  });

itSerial("does not take the reread path when the only change is stale memory", async () => {
    const prior = await seedMemoryCase();
    const related = [{ memory: prior.memory, score: 0.5, overlap: 3 }];
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros", related);
    assert.equal(seeded.dossier.known[0]?.memoryId, prior.memory.id);
    useKernel.getState().forgetMemory(prior.memory.id);
    const io = trackingIO({ forbidRead: true });
    const result = await runWatch(seeded.goalId, io);
    assert.equal(result.status, "blocked");
    if (result.status === "blocked") {
      assert.match(result.reason, /memoria consultada/i);
      assert.match(result.reason, /Reinterpretar/);
    }
    assert.equal(io.reads.length, 0);
    assert.equal(io.interprets, 0);
    assert.equal(useKernel.getState().dossiers.filter((item) => item.goalId === seeded.goalId).length, 1);

  });
});

describe("reinterpretWithMemory", { concurrency: false }, () => {

itSerial("produces a new seal without any network read", async () => {
    const prior = await seedMemoryCase();
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros", [
      { memory: prior.memory, score: 0.5, overlap: 3 },
    ]);
    const frozen = structuredClone(seeded.dossier);
    useKernel.getState().forgetMemory(prior.memory.id);
    const io = trackingIO({ forbidRead: true });
    const result = await reinterpretWithMemory(seeded.goalId, io);
    assert.equal(result.status, "reinterpreted");
    assert.equal(io.reads.length, 0);
    assert.equal(io.searches, 0);
    assert.equal(io.interprets, 1);
    const after = useKernel.getState();
    const seals = sealsForGoal(after.dossiers, seeded.goalId);

    assert.equal(seals.length, 2);
    const newest = seals[0];
    const previous = seals.find((item) => item.id === frozen.id);
    assert.ok(newest && previous);
    assert.equal(previous.sealHash, frozen.sealHash);
    assert.deepEqual(previous.known, frozen.known);
    assert.deepEqual(previous.evidenceHashes, frozen.evidenceHashes);
    assert.deepEqual([...newest.evidenceHashes].sort(), [...frozen.evidenceHashes].sort());
    assert.notEqual(newest.memoryContextHash, frozen.memoryContextHash);
    assert.notEqual(newest.sealHash, frozen.sealHash);
    assert.equal(newest.supersedesId, frozen.id);
    assert.match(sealChangeNote(newest, previous), /memoria consultada/);
    const memoryIds = new Set(after.memory.map((item) => item.id));
    for (const finding of after.findings.filter((item) => newest.findingIds.includes(item.id))) {
      assert.equal(finding.evidenceIds.some((id) => memoryIds.has(id)), false);
      assert.ok(finding.evidenceIds.every((id) => after.evidence.some((row) => row.id === id)));
    }
    assert.equal(newest.evidenceIds.some((id) => memoryIds.has(id)), false);
  });
});

describe("doctrine through operations", { concurrency: false }, () => {

itSerial("does not let later memory appear on an earlier seal", async () => {
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros");
    await seedMemoryCase();
    const stored = useKernel.getState().dossiers.find((item) => item.id === seeded.dossier.id);
    assert.ok(stored);
    assert.equal(stored.known.length, 0);
    assert.equal(stored.sealHash, seeded.dossier.sealHash);
    const live = useKernel.getState();
    const related = relatedMemory(
      live.goals.find((item) => item.id === seeded.goalId)?.text ?? "",
      live.memory,
      live.findings,
      seeded.goalId,
    );
    const note = memoryConsultNote(stored, related, live.memory);
    assert.match(note ?? "", /no consultó/);
  });

itSerial("names forgotten consulted memory as historical and not vigente", async () => {
    const prior = await seedMemoryCase();
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros", [
      { memory: prior.memory, score: 0.5, overlap: 3 },
    ]);
    useKernel.getState().forgetMemory(prior.memory.id);
    const stored = useKernel.getState().dossiers.find((item) => item.id === seeded.dossier.id);
    assert.ok(stored);
    assert.equal(stored.known[0]?.memoryId, prior.memory.id);
    const note = memoryConsultNote(stored, [], useKernel.getState().memory);
    assert.match(note ?? "", /histórica/);
    assert.match(note ?? "", /no está vigente/);
    const live = useKernel.getState();
    const related = relatedMemory(
      live.goals.find((item) => item.id === seeded.goalId)?.text ?? "",
      live.memory,
      live.findings,
      seeded.goalId,
    );
    assert.equal(
      chooseInstrument(stored, live.evidence.filter((item) => item.goalId === seeded.goalId), related, live.memory),
      "REINTERPRETAR",
    );
  });

itSerial("keeps evidence identity when memory is forgotten", async () => {
    const prior = await seedMemoryCase();
    const hash = prior.evidence.contentHash;
    useKernel.getState().forgetMemory(prior.memory.id);
    const live = useKernel.getState().evidence.find((item) => item.id === prior.evidence.id);
    assert.ok(live);
    assert.equal(live.contentHash, hash);
    assert.equal(admittedMemory(useKernel.getState().memory).length, 0);
  });

itSerial("survives six reseals without mutating the first", async () => {
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros");
    const firstHash = seeded.dossier.sealHash;
    const firstId = seeded.dossier.id;
    const kernel = useKernel.getState();
    for (let i = 1; i <= 5; i += 1) {
      const extra = evidenceOf(seeded.goalId, {
        id: `e_r${i}_${seeded.goalId}`,
        url: `https://example.org/drill-${i}`,
        sourceHost: "example.org",
        contentHash: `otherhash${i}234567890ab`,
        retrievedAt: `2026-08-29T0${i}:00:00.000Z`,
      });
      assert.equal(kernel.tryAdmitEvidence(extra).ok, true);
      const io = trackingIO({ forbidRead: true });
      const result = await incorporateUncovered(seeded.goalId, io);
      assert.equal(result.status, "incorporated");
      assert.equal(io.reads.length, 0);
    }
    const dossiers = useKernel.getState().dossiers.filter((item) => item.goalId === seeded.goalId);
    assert.equal(dossiers.length, 6);
    const newest = sealsForGoal(dossiers, seeded.goalId)[0];
    const chain = sealLineage(dossiers, newest);
    assert.equal(chain.length, 6);
    const first = dossiers.find((item) => item.id === firstId);
    assert.equal(first?.sealHash, firstHash);
    assert.equal(first?.supersedesId, undefined);
    assert.equal(newest.supersedesId, chain[1]?.id);
    const diff = compareSeals(newest, first!);
    assert.ok(diff.added >= 1);
  });

itSerial("T0 memory then T1 reinterpret then reread: causes stay distinct", async () => {
    const prior = await seedMemoryCase();
    const seeded = await seedSealedCase("Taladro de calidad 18-25 euros", [
      { memory: prior.memory, score: 0.5, overlap: 3 },
    ]);
    const s1 = structuredClone(seeded.dossier);
    useKernel.getState().forgetMemory(prior.memory.id);
    const next = await seedMemoryCase();
    const ioReinterpret = trackingIO({ forbidRead: true });
    const reinterpreted = await reinterpretWithMemory(seeded.goalId, ioReinterpret);
    assert.equal(reinterpreted.status, "reinterpreted");
    assert.equal(ioReinterpret.reads.length, 0);
    const afterRe = useKernel.getState();
    const sealsAfterRe = sealsForGoal(afterRe.dossiers, seeded.goalId);
    assert.equal(sealsAfterRe.length, 2);
    const s2 = sealsAfterRe[0];
    const storedS1 = sealsAfterRe.find((item) => item.id === s1.id);
    assert.ok(s2 && storedS1);
    assert.equal(storedS1.sealHash, s1.sealHash);
    assert.deepEqual(storedS1.known.map((item) => item.memoryId), [prior.memory.id]);
    assert.equal(sealCause(s2, storedS1), "memory");
    assert.deepEqual([...s2.evidenceHashes].sort(), [...s1.evidenceHashes].sort());
    assert.ok(s2.known.some((item) => item.memoryId === next.memory.id));

    const ioWatch = trackingIO({
      read: async (url) => ({
        ok: true,
        url,
        title: "Taladro 22 EUR",
        sourceHost: "example.com",
        excerpt: "El precio ahora es 22 EUR en la ficha pública observada.",
        contentHash: "zzz123def4567890abcd",
        httpStatus: 200,
        bytes: 60,
        retrievedAt: "2026-08-29T08:00:00.000Z",
      }),
    });
    const watched = await runWatch(seeded.goalId, ioWatch);
    assert.equal(watched.status, "changed");
    assert.ok(ioWatch.reads.length >= 1);
    const afterWatch = useKernel.getState();
    const seals = sealsForGoal(afterWatch.dossiers, seeded.goalId);
    assert.equal(seals.length, 3);
    const s3 = seals[0];
    const storedS2 = seals.find((item) => item.id === s2.id);
    const stillS1 = seals.find((item) => item.id === s1.id);
    assert.ok(s3 && storedS2 && stillS1);
    assert.equal(stillS1.sealHash, s1.sealHash);
    assert.equal(storedS2.sealHash, s2.sealHash);
    assert.equal(sealCause(s3, storedS2), "evidence");
    assert.equal(sealCause(storedS2, stillS1), "memory");
    assert.notEqual(s3.evidenceHashes.join(), s2.evidenceHashes.join());
    const rows = afterWatch.contradictions;
    const interpretation = rows.find((item) => item.kind === "interpretation-interpretation");
    const evidenceChange = rows.find((item) => item.kind === "evidence-evidence");
    assert.ok(interpretation);
    assert.ok(evidenceChange);
    assert.equal(interpretation.left.kind, "seal");
    assert.equal(interpretation.right.kind, "seal");
    assert.match(interpretation.note, /memoria consultada/);
    assert.equal(interpretation.note.includes("huella"), false);
    assert.equal(evidenceChange.left.kind, "evidence");
    assert.equal(evidenceChange.right.kind, "evidence");
    assert.match(evidenceChange.note, /huella/);
    assert.equal(evidenceChange.note.includes("memoria"), false);
    assert.equal(
      rows.some(
        (item) =>
          item.kind === "evidence-evidence" &&
          (item.left.kind === "memory" || item.right.kind === "memory"),
      ),
      false,
    );
  });
});
});
