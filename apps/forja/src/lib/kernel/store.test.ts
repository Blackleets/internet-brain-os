import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDossier, sealsForGoal, sealLineage } from "./dossier.ts";
import { admittedMemory, explainMemory, liveMemory, memoryLineage } from "./authority.ts";
import { kernelFingerprint } from "./replay.ts";
import { inspectKernel, kernelMetrics } from "./observability.ts";
import { useKernel } from "./store.ts";
import { itIsolated as itSerial, withIsolatedKernel } from "./test-isolate.ts";
import { WATCH_HISTORY_POLICY } from "./watch.ts";
import type { Evidence, Finding } from "./types.ts";

function seedCase(text = "Taladro 18-25 euros") {

  const kernel = useKernel.getState();
  const goal = kernel.createGoal(text);
  const evidence: Evidence = {
    id: `e_${goal.id}`,
    goalId: goal.id,
    url: "https://example.com/drill",
    title: "Taladro 20 EUR",
    sourceHost: "example.com",
    excerpt: "Taladro 20 EUR observado en ficha pública.",
    contentHash: "abc123def4567890abcd",
    retrievedAt: "2026-08-29T00:00:00.000Z",
    httpStatus: 200,
    bytes: 40,
    validation: "retrieved",
  };
  const finding: Finding = {
    id: `f_${goal.id}`,
    goalId: goal.id,
    title: "Precio observado",
    answer: "Hay un taladro a 20 EUR.",
    whyItMatters: "Encaja en el rango.",
    confidence: "medium",
    evidenceIds: [evidence.id],
    uncertainties: ["Una sola fuente"],
    nextAction: "Comparar otra tienda",
    interpretationAvailable: true,
    createdAt: evidence.retrievedAt,
  };
  assert.equal(kernel.tryAdmitEvidence(evidence).ok, true);
  assert.equal(kernel.tryAdmitFinding(finding).ok, true);
  return { goalId: goal.id, evidence, finding };
}

describe("kernel store isolation", { concurrency: false }, () => {
  it("mutex keeps parallel withIsolatedKernel from sharing goals", async () => {
    const counts = await Promise.all([
      withIsolatedKernel(async () => {
        useKernel.getState().createGoal("Caso A de aislamiento");
        await new Promise((resolve) => setTimeout(resolve, 15));
        return useKernel.getState().goals.length;
      }),
      withIsolatedKernel(async () => {
        useKernel.getState().createGoal("Caso B de aislamiento");
        await new Promise((resolve) => setTimeout(resolve, 5));
        return useKernel.getState().goals.length;
      }),
    ]);
    assert.deepEqual(counts, [1, 1]);
    assert.equal(useKernel.getState().goals.length, 0);
  });
});

describe("sealDossier lineage", { concurrency: false }, () => {

  itSerial("keeps previous seals and points the new one at the previous", async () => {
    const { goalId, evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    const goal = kernel.goals.find((item) => item.id === goalId);
    assert.ok(goal);
    const first = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(first);
    assert.equal(kernel.sealDossier(first).ok, true);
    const secondFinding: Finding = {
      ...finding,
      id: "f_later",
      title: "Relectura",
      answer: "Sigue a 20 EUR tras otra lectura.",
      createdAt: "2026-08-29T02:00:00.000Z",
    };
    assert.equal(kernel.tryAdmitFinding(secondFinding).ok, true);
    const after = useKernel.getState();
    const liveGoal = after.goals.find((item) => item.id === goalId);
    assert.ok(liveGoal);
    const second = await composeDossier({
      goal: liveGoal,
      findings: [secondFinding, finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(second);
    const frozenFirst = structuredClone(first);
    assert.equal(after.sealDossier(second).ok, true);
    const seals = sealsForGoal(useKernel.getState().dossiers, goalId);
    assert.equal(seals.length, 2);
    assert.equal(seals[0]?.id, second.id);
    assert.equal(seals[0]?.supersedesId, first.id);
    const storedFirst = seals.find((item) => item.id === first.id);
    assert.equal(storedFirst?.sealHash, frozenFirst.sealHash);
    assert.equal(storedFirst?.executive, frozenFirst.executive);
  });

  itSerial("keeps the entire chain after more than four reseals", async () => {
    const { goalId, evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    const hashes: string[] = [];
    const ids: string[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const extra: Evidence = {
        ...evidence,
        id: `e_r${i}_${goalId}`,
        url: `https://example.com/drill-${i}`,
        contentHash: `uniqhash${i}234567890ab`,
        retrievedAt: `2026-08-29T0${i}:00:00.000Z`,
      };
      assert.equal(kernel.tryAdmitEvidence(extra).ok, true);
      const row: Finding = {
        ...finding,
        id: `f_r${i}_${goalId}`,
        title: `Lectura ${i}`,
        answer: `Síntesis número ${i} del caso con fuente ${i}.`,
        evidenceIds: [extra.id],
        createdAt: `2026-08-29T0${i}:00:00.000Z`,
      };
      assert.equal(kernel.tryAdmitFinding(row).ok, true);
      const live = useKernel.getState().goals.find((item) => item.id === goalId);
      assert.ok(live);
      const dossier = await composeDossier({
        goal: live,
        findings: useKernel.getState().findings.filter((item) => item.goalId === goalId),
        evidence: useKernel.getState().evidence.filter((item) => item.goalId === goalId),
        related: [],
      });
      assert.ok(dossier);
      assert.equal(kernel.sealDossier(dossier).ok, true);
      hashes.push(dossier.sealHash);
      ids.push(dossier.id);
    }
    const dossiers = useKernel.getState().dossiers.filter((item) => item.goalId === goalId);
    assert.equal(new Set(hashes).size, 6);
    assert.equal(dossiers.length, 6);
    const newest = sealsForGoal(dossiers, goalId)[0];
    const chain = sealLineage(dossiers, newest);
    assert.equal(chain.length, 6);
    for (const hash of hashes) {
      assert.ok(dossiers.some((item) => item.sealHash === hash));
    }
    for (const id of ids) {
      assert.ok(dossiers.some((item) => item.id === id));
    }
  });

  itSerial("does not rewrite an old seal when later memory is admitted", async () => {
    const { goalId, evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    const goal = kernel.goals.find((item) => item.id === goalId);
    assert.ok(goal);
    const first = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(first);
    assert.equal(kernel.sealDossier(first).ok, true);
    assert.equal(first.known.length, 0);
    assert.equal(kernel.admitFindingToMemory(finding.id, "Lo guardo para el siguiente caso.").ok, true);
    const stored = useKernel.getState().dossiers.find((item) => item.id === first.id);
    assert.ok(stored);
    assert.equal(stored.known.length, 0);
    assert.equal(stored.sealHash, first.sealHash);
    assert.equal(
      stored.known.some((item) => item.memoryId === useKernel.getState().memory[0]?.id),
      false,
    );
  });

  itSerial("keeps the frozen consult after that memory is forgotten", async () => {
    const { goalId, evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Lo guardo para el siguiente caso.").ok, true);
    const memory = useKernel.getState().memory[0];
    assert.ok(memory);
    const other = kernel.createGoal("Otro taladro de 20 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Otro precio",
      answer: "Otra ficha lista un taladro a 20 EUR.",
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    const otherGoal = useKernel.getState().goals.find((item) => item.id === other.id);
    assert.ok(otherGoal);
    const sealed = await composeDossier({
      goal: otherGoal,
      findings: [otherFinding],
      evidence: [otherEvidence],
      related: [{ memory, score: 0.4, overlap: 2 }],
    });
    assert.ok(sealed);
    assert.equal(kernel.sealDossier(sealed).ok, true);
    const snap = structuredClone(sealed.known);
    kernel.forgetMemory(memory.id);
    const stored = useKernel.getState().dossiers.find((item) => item.id === sealed.id);
    assert.ok(stored);
    assert.equal(stored.sealHash, sealed.sealHash);
    assert.deepEqual(stored.known, snap);
    assert.equal(stored.known[0]?.memoryId, memory.id);
    assert.equal(admittedMemory(useKernel.getState().memory).length, 0);
    assert.equal(useKernel.getState().memory.find((item) => item.id === memory.id)?.lifecycle, "revoked");
    assert.ok(useKernel.getState().evidence.find((item) => item.id === evidence.id));
    void goalId;
  });
});

describe("evidence identity vs memory", { concurrency: false }, () => {

  itSerial("keeps evidence when memory is forgotten", () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const memory = useKernel.getState().memory[0];
    assert.ok(memory);
    kernel.forgetMemory(memory.id);
    const live = useKernel.getState().evidence.find((item) => item.id === evidence.id);
    assert.ok(live);
    assert.equal(live.contentHash, evidence.contentHash);
    assert.equal(admittedMemory(useKernel.getState().memory).length, 0);
    assert.equal(useKernel.getState().memory[0]?.lifecycle, "revoked");
  });

  itSerial("refuses to admit a memory id as evidence", () => {
    const { finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const memory = useKernel.getState().memory[0];
    assert.ok(memory);
    const result = kernel.tryAdmitEvidence({
      id: memory.id,
      goalId: finding.goalId,
      url: "https://example.com/not-memory",
      title: "No",
      sourceHost: "example.com",
      excerpt: "Esto no debería entrar como evidencia observada.",
      contentHash: "fff123def4567890abcd",
      retrievedAt: "2026-08-29T03:00:00.000Z",
      httpStatus: 200,
      bytes: 20,
      validation: "retrieved",
    });
    assert.equal(result.ok, false);
  });
});

describe("contradictions persist", { concurrency: false }, () => {
  itSerial("records evidence-evidence when the same url changes hash", () => {
    const { goalId, evidence } = seedCase();
    const kernel = useKernel.getState();
    const later: Evidence = {
      ...evidence,
      id: `e2_${goalId}`,
      contentHash: "zzz123def4567890abcd",
      retrievedAt: "2026-08-29T08:00:00.000Z",
      excerpt: "Taladro 22 EUR observado en la misma ficha.",
      title: "Taladro 22 EUR",
    };
    assert.equal(kernel.tryAdmitEvidence(later).ok, true);
    const rows = useKernel.getState().contradictions.filter((item) => item.kind === "evidence-evidence");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.left.kind, "evidence");
    assert.equal(rows[0]?.right.kind, "evidence");
    assert.equal(rows[0]?.left.id === rows[0]?.right.id, false);
    assert.match(rows[0]?.note ?? "", /huella/);
  });

  itSerial("records evidence-memory then memory-memory, and keeps them after forget", () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const prior = useKernel.getState().memory[0];
    assert.ok(prior);
    const other = kernel.createGoal("Taladro listado a 80 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
      excerpt: "La ficha lista 80 EUR, no 20.",
      title: "Taladro 80 EUR",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR, no el precio admitido.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: prior.id,
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    const em = useKernel
      .getState()
      .contradictions.find((item) => item.kind === "evidence-memory");
    assert.ok(em);
    assert.equal(em.left.kind, "evidence");
    assert.equal(em.right.kind, "memory");
    assert.equal(em.right.id, prior.id);
    assert.equal(em.open, true);
    assert.equal(
      useKernel.getState().contradictions.some((item) => item.kind === "memory-memory"),
      false,
    );

    assert.equal(
      kernel.admitFindingToMemory(otherFinding.id, "Sustituye el precio anterior observado.").ok,
      true,
    );
    const mm = useKernel
      .getState()
      .contradictions.find((item) => item.kind === "memory-memory");
    assert.ok(mm);
    assert.equal(mm.left.kind, "memory");
    assert.equal(mm.right.kind, "memory");
    assert.equal(mm.open, true);
    const mmId = mm.id;

    kernel.forgetMemory(prior.id);
    const kept = useKernel
      .getState()
      .contradictions.find((item) => item.id === mmId);
    assert.ok(kept);
    assert.equal(kept.open, false);
    assert.equal(kept.right.id, prior.id);
    assert.equal(
      useKernel.getState().contradictions.some((item) => item.kind === "evidence-evidence"),
      false,
    );
    assert.equal(useKernel.getState().memory.find((item) => item.id === prior.id)?.lifecycle, "revoked");
  });
});

describe("memory authority history", { concurrency: false }, () => {
  itSerial("records proposed then admitted, and never deletes on revoke", () => {
    const { finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const record = useKernel.getState().memory[0];
    assert.ok(record);
    const decisions = useKernel.getState().memoryDecisions.filter((item) => item.memoryId === record.id);
    assert.equal(decisions.some((item) => item.to === "proposed" && item.from === null), true);
    assert.equal(decisions.some((item) => item.to === "admitted" && item.from === "proposed"), true);
    assert.equal(record.lifecycle, "admitted");
    kernel.forgetMemory(record.id);
    const kept = useKernel.getState().memory.find((item) => item.id === record.id);
    assert.ok(kept);
    assert.equal(kept.lifecycle, "revoked");
    assert.equal(admittedMemory(useKernel.getState().memory).length, 0);
    assert.equal(liveMemory(useKernel.getState().memory).length, 0);
    const revoke = useKernel.getState().memoryDecisions.find((item) => item.to === "revoked");
    assert.ok(revoke);
    assert.equal(revoke.actor, "operator");
    assert.equal(revoke.policy, "operator-revoke");
    assert.equal(revoke.memoryId, record.id);
  });

  itSerial("supersedes without reusing ids and leaves the old seal pointing at M1", async () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const m1 = useKernel.getState().memory[0];
    assert.ok(m1);
    const other = kernel.createGoal("Taladro listado a 80 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
      excerpt: "La ficha lista 80 EUR, no 20.",
      title: "Taladro 80 EUR",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR, no el precio admitido.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: m1.id,
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    const otherGoal = useKernel.getState().goals.find((item) => item.id === other.id);
    assert.ok(otherGoal);
    const sealed = await composeDossier({
      goal: otherGoal,
      findings: [otherFinding],
      evidence: [otherEvidence],
      related: [{ memory: m1, score: 0.5, overlap: 3 }],
    });
    assert.ok(sealed);
    assert.equal(kernel.sealDossier(sealed).ok, true);
    const sealHash = sealed.sealHash;
    const known = structuredClone(sealed.known);
    const before = useKernel.getState().contradictions.filter((item) => item.kind === "evidence-memory");
    assert.ok(before.length);

    assert.equal(
      kernel.replaceTensedMemory(otherFinding.id, "Sustituye el precio anterior observado.").ok,
      true,
    );
    const live = useKernel.getState();
    const m2 = live.memory.find((item) => item.findingId === otherFinding.id);
    const prior = live.memory.find((item) => item.id === m1.id);
    assert.ok(m2 && prior);
    assert.equal(m2.id === m1.id, false);
    assert.equal(prior.lifecycle, "superseded");
    assert.equal(prior.supersededById, m2.id);
    assert.equal(m2.supersedesId, m1.id);
    assert.deepEqual(
      memoryLineage(live.memory, m1.id).map((item) => item.id),
      [m1.id, m2.id],
    );
    const stored = live.dossiers.find((item) => item.id === sealed.id);
    assert.ok(stored);
    assert.equal(stored.sealHash, sealHash);
    assert.deepEqual(stored.known, known);
    assert.equal(stored.known[0]?.memoryId, m1.id);
    assert.equal(live.evidence.some((item) => item.id === m1.id || item.id === m2.id), false);
    assert.equal(
      live.findings.some((item) => item.evidenceIds.includes(m1.id) || item.evidenceIds.includes(m2.id)),
      false,
    );
    const explained = explainMemory({
      memoryId: m1.id,
      memory: live.memory,
      decisions: live.memoryDecisions,
      dossiers: live.dossiers,
      contradictions: live.contradictions,
    });
    assert.equal(explained?.lifecycle, "superseded");
    assert.equal(explained?.usedBySeals[0]?.lifecycleAtConsult, "admitted");
    assert.equal(explained?.supersededById, m2.id);
  });

  itSerial("does not let a contradiction delete either memory", () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const m1 = useKernel.getState().memory[0];
    assert.ok(m1);
    const other = kernel.createGoal("Taladro listado a 80 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
      excerpt: "La ficha lista 80 EUR, no 20.",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR, no el precio admitido.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: m1.id,
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    assert.equal(kernel.admitFindingToMemory(otherFinding.id, "Conservo ambas lecturas.").ok, true);
    const live = useKernel.getState();
    assert.equal(admittedMemory(live.memory).length, 2);
    assert.ok(live.memory.find((item) => item.id === m1.id && item.lifecycle === "admitted"));
    assert.ok(live.contradictions.some((item) => item.kind === "memory-memory" && item.open));
  });
});

describe("replay is read-only", { concurrency: false }, () => {
  itSerial("does not change seals, memory, decisions or contradictions", async () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const m1 = useKernel.getState().memory[0];
    assert.ok(m1);
    const other = kernel.createGoal("Taladro listado a 80 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
      excerpt: "La ficha lista 80 EUR, no 20.",
      title: "Taladro 80 EUR",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR, no el precio admitido.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: m1.id,
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    const otherGoal = useKernel.getState().goals.find((item) => item.id === other.id);
    assert.ok(otherGoal);
    const sealed = await composeDossier({
      goal: otherGoal,
      findings: [otherFinding],
      evidence: [otherEvidence],
      related: [{ memory: m1, score: 0.5, overlap: 3 }],
    });
    assert.ok(sealed);
    assert.equal(kernel.sealDossier(sealed).ok, true);
    kernel.forgetMemory(m1.id);
    const live = useKernel.getState();
    const before = kernelFingerprint(live);
    const first = live.replaySeal(sealed.id);
    const second = useKernel.getState().replaySeal(sealed.id);
    const after = kernelFingerprint(useKernel.getState());
    assert.equal(after, before);
    assert.deepEqual(first, second);
    assert.equal(first.status, "complete");
    assert.equal(first.memory[0]?.memoryId, m1.id);
    assert.equal(first.memory[0]?.lifecycleAtConsult, "admitted");
    assert.equal(useKernel.getState().memory.find((item) => item.id === m1.id)?.lifecycle, "revoked");
    assert.equal(useKernel.getState().dossiers[0]?.sealHash, sealed.sealHash);
  });
});

describe("learning loop", { concurrency: false }, () => {
  itSerial("observes a candidate from a finding and only Memory Authority admits it", () => {
    const { finding } = seedCase();
    const live = useKernel.getState();
    const candidate = live.learning.find((item) => item.findingIds.includes(finding.id));
    assert.ok(candidate);
    assert.equal(candidate.status === "admitted", false);
    assert.equal(candidate.origin.kind, "finding");
    assert.equal(candidate.evidenceIds.includes(finding.evidenceIds[0] ?? ""), true);
    assert.equal(
      live.acceptLearning(candidate.id, "Admitir este aprendizaje.").ok,
      true,
    );
    const after = useKernel.getState();
    const kept = after.learning.find((item) => item.id === candidate.id);
    assert.ok(kept);
    assert.equal(kept.status, "admitted");
    const record = after.memory.find((item) => item.id === kept.memoryId);
    assert.ok(record);
    assert.equal(record.candidateId, candidate.id);
    assert.equal(record.lifecycle, "admitted");
    assert.equal(after.learning.find((item) => item.id === candidate.id)?.id, candidate.id);
  });

  itSerial("does not let a contradictory candidate overwrite memory", () => {
    const { evidence, finding } = seedCase();
    const kernel = useKernel.getState();
    assert.equal(kernel.admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const m1 = useKernel.getState().memory[0];
    assert.ok(m1);
    const other = kernel.createGoal("Taladro listado a 80 euros");
    const otherEvidence: Evidence = {
      ...evidence,
      id: `e_${other.id}`,
      goalId: other.id,
      url: "https://example.org/other-drill",
      contentHash: "otherhash1234567890ab",
      excerpt: "La ficha lista 80 EUR, no 20.",
      title: "Taladro 80 EUR",
    };
    const otherFinding: Finding = {
      ...finding,
      id: `f_${other.id}`,
      goalId: other.id,
      evidenceIds: [otherEvidence.id],
      title: "Precio distinto",
      answer: "La ficha lista 80 EUR, no el precio admitido.",
      delta: "tension",
      deltaNote: "El extracto lista 80 EUR, no 20.",
      deltaMemoryId: m1.id,
    };
    assert.equal(kernel.tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(kernel.tryAdmitFinding(otherFinding).ok, true);
    const candidate = useKernel
      .getState()
      .learning.find((item) => item.findingIds.includes(otherFinding.id));
    assert.ok(candidate);
    assert.equal(candidate.relation, "contradiction");
    assert.equal(
      useKernel.getState().acceptLearning(candidate.id, "Sobrescribo la memoria.").ok,
      false,
    );
    assert.equal(useKernel.getState().memory.find((item) => item.id === m1.id)?.lifecycle, "admitted");
    assert.ok(useKernel.getState().contradictions.some((item) => item.kind === "evidence-memory"));
  });
});

describe("confidence engine", { concurrency: false }, () => {
  itSerial("records a support evaluation without admitting memory", () => {
    const { finding } = seedCase();
    const live = useKernel.getState();
    const row = live.confidence.find((item) => item.findingId === finding.id);
    assert.ok(row);
    assert.equal(typeof row.score, "number");
    assert.equal(row.algorithm, "efesto-support-v1");
    assert.equal(row.policyVersion, 1);
    assert.equal(live.memory.length, 0);
  });

  itSerial("keeps the first evaluation when a later version is created", () => {
    const { finding } = seedCase();
    const first = useKernel.getState().confidence.find((item) => item.findingId === finding.id);
    assert.ok(first);
    const snapshot = structuredClone(first);
    assert.equal(
      useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok,
      true,
    );
    const kept = useKernel.getState().confidence.find((item) => item.id === first.id);
    assert.deepEqual(kept, snapshot);
  });
});

describe("observability", { concurrency: false }, () => {
  itSerial("records structured events with a correlation id", () => {
    const { goalId, finding } = seedCase();
    const live = useKernel.getState();
    assert.equal(live.activity.every((item) => Boolean(item.correlationId)), true);
    assert.equal(live.activity.some((item) => item.correlationId === goalId), true);
    assert.equal(live.activity.some((item) => item.kind === "finding.admitted" && item.findingId === finding.id), true);
    assert.equal(inspectKernel(live).status, "healthy");
    assert.equal(kernelMetrics(live).evidenceAdmitted >= 1, true);
    assert.equal(kernelMetrics(live).learningCandidates >= 1, true);
  });

  itSerial("keeps historical events when a later version is recorded", () => {
    const { finding } = seedCase();
    const first = useKernel.getState().activity.find((item) => item.kind === "finding.admitted");
    assert.ok(first);
    const snapshot = structuredClone(first);
    assert.equal(useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok, true);
    const kept = useKernel.getState().activity.find((item) => item.id === first.id);
    assert.deepEqual(kept, snapshot);
  });
});

describe("identity immutability", { concurrency: false }, () => {
  itSerial("refuses to rewrite an admitted evidence id", () => {
    const { evidence } = seedCase();
    const before = structuredClone(useKernel.getState().evidence.find((item) => item.id === evidence.id));
    const result = useKernel.getState().tryAdmitEvidence({
      ...evidence,
      contentHash: "zzzzzzzzzzzzzzzzzzzz",
      excerpt: "Otra observación distinta de la retenida.",
    });
    assert.equal(result.ok, false);
    assert.deepEqual(useKernel.getState().evidence.find((item) => item.id === evidence.id), before);
  });

  itSerial("refuses to rewrite an admitted finding id", () => {
    const { finding } = seedCase();
    const before = structuredClone(useKernel.getState().findings.find((item) => item.id === finding.id));
    const result = useKernel.getState().tryAdmitFinding({
      ...finding,
      title: "Otro título",
      answer: "Otra respuesta que no estaba retenida.",
    });
    assert.equal(result.ok, false);
    assert.deepEqual(useKernel.getState().findings.find((item) => item.id === finding.id), before);
  });
});

describe("integrity fail-closed", { concurrency: false }, () => {
  itSerial("refuses a write when the Kernel has integrity errors", () => {
    const { evidence } = seedCase();
    useKernel.setState({
      findings: [
        ...useKernel.getState().findings,
        {
          id: "f_broken",
          goalId: "g_missing",
          title: "Roto",
          answer: "Cita un caso que no existe.",
          whyItMatters: "Fuerza un error de integridad.",
          confidence: "low",
          evidenceIds: ["e_missing"],
          uncertainties: [],
          nextAction: "",
          interpretationAvailable: false,
          createdAt: "2026-08-29T00:00:00.000Z",
        },
      ],
    });
    const result = useKernel.getState().tryAdmitEvidence({
      ...evidence,
      id: "e_after_corrupt",
      url: "https://example.com/other-drill",
      contentHash: "otherhash1234567890ab",
    });
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /Integridad/);
    assert.equal(useKernel.getState().evidence.some((item) => item.id === "e_after_corrupt"), false);
  });
});

describe("quarantine surface", { concurrency: false }, () => {
  itSerial("quarantines a learning candidate and only Authority admits it later", () => {
    const { finding } = seedCase();
    const candidate = useKernel
      .getState()
      .learning.find((item) => item.findingIds.includes(finding.id) && item.status === "ready");
    assert.ok(candidate);
    assert.equal(
      useKernel.getState().quarantineLearning(candidate.id, "Lo reviso con calma después.").ok,
      true,
    );
    const held = useKernel.getState().memory.find((item) => item.findingId === finding.id);
    assert.equal(held?.lifecycle, "quarantined");
    assert.equal(admittedMemory(useKernel.getState().memory).length, 0);
    assert.equal(
      useKernel.getState().admitQuarantined(held!.id, "Ya lo contrasté con la ficha.").ok,
      true,
    );
    assert.equal(useKernel.getState().memory.find((item) => item.id === held!.id)?.lifecycle, "admitted");
  });
});

describe("watch history", { concurrency: false }, () => {
  itSerial("keeps more than eighty watch passes", () => {
    assert.equal(WATCH_HISTORY_POLICY.truncate, false);
    const { goalId } = seedCase();
    for (let i = 0; i < 81; i += 1) {
      useKernel.getState().recordWatchPass({
        id: `w_${i}`,
        goalId,
        at: `2026-08-29T01:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}.000Z`,
        observations: [],
        stable: 1,
        changed: 0,
        missing: 0,
        blocked: 0,
      });
    }
    assert.equal(useKernel.getState().watchPasses.length, 81);
  });
});

describe("kernel snapshot", { concurrency: false }, () => {
  itSerial("export then import restores the kernel without inventing evidence", () => {
    const { goalId, evidence } = seedCase();
    const json = useKernel.getState().exportKernel();
    const before = kernelFingerprint(useKernel.getState());
    useKernel.getState().clearKernel();
    assert.equal(useKernel.getState().goals.length, 0);
    const rejected = useKernel.getState().importKernel("{nope");
    assert.equal(rejected.ok, false);
    const restored = useKernel.getState().importKernel(json);
    assert.equal(restored.ok, true);
    assert.equal(useKernel.getState().goals[0]?.id, goalId);
    assert.equal(useKernel.getState().evidence[0]?.contentHash, evidence.contentHash);
    assert.equal(kernelFingerprint(useKernel.getState()), before);
  });
});
