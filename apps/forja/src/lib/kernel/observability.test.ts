import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeDossier } from "./dossier.ts";
import {
  ACTIVITY_KIND_LABEL,
  KERNEL_OBSERVABILITY_BOUNDARIES,
  OBSERVABILITY_FAILURE_POLICY,
  activityFingerprint,
  allocateActivityId,
  appendActivity,
  causalChain,
  eventAsEvidence,
  eventMutateMemory,
  eventsForMemory,
  inspectKernel,
  integrityErrors,
  kernelMetrics,
  metricMutatePolicy,
  mutateCodeFromObservability,
  mutatePoliciesFromObservability,
  observabilityAdmitMemory,
  overwriteActivity,
  recordReplayActivity,
  repairKernel,
  assertKernelWritable,
} from "./observability.ts";
import { replaySeal } from "./replay.ts";
import { useKernel } from "./store.ts";
import { itIsolated as itSerial } from "./test-isolate.ts";
import type {
  ActivityEvent,
  Evidence,
  Finding,
  KernelState,
} from "./types.ts";

const T0 = "2026-08-29T00:00:00.000Z";
const T1 = "2026-08-29T01:00:00.000Z";
const T2 = "2026-08-29T02:00:00.000Z";

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
    retrievedAt: T0,
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

function draft(over: Partial<ActivityEvent> & Pick<ActivityEvent, "kind" | "summary">) {
  return over;
}

describe("observability engine", { concurrency: false }, () => {
  itSerial("1. operación genera evento", () => {
    const { goalId } = seedCase();
    const events = useKernel.getState().activity;
    assert.equal(events.some((item) => item.kind === "goal.created" && item.goalId === goalId), true);
    assert.equal(events.some((item) => item.kind === "evidence.admitted"), true);
    assert.equal(events.some((item) => item.kind === "finding.admitted"), true);
  });

  itSerial("2. evento tiene correlationId", () => {
    const { goalId } = seedCase();
    const events = useKernel.getState().activity.filter((item) => item.goalId === goalId);
    assert.equal(events.length > 0, true);
    assert.equal(events.every((item) => item.correlationId === goalId), true);
    assert.equal(events.every((item) => Boolean(item.actor && item.source)), true);
  });

  itSerial("3. cadena causal reconstruible", () => {
    const { goalId, finding } = seedCase();
    assert.equal(
      useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok,
      true,
    );
    const events = useKernel.getState().activity;
    const admitted = events.find((item) => item.kind === "memory.admitted");
    assert.ok(admitted);
    const chain = causalChain(events, admitted.id);
    assert.equal(chain.some((item) => item.kind === "goal.created"), true);
    assert.equal(chain.some((item) => item.kind === "finding.admitted"), true);
    assert.equal(chain[0]?.correlationId, goalId);
    assert.equal(admitted.causal?.causedBy != null, true);
  });

  itSerial("4. admission genera evento correcto", () => {
    const { evidence, finding } = seedCase();
    const events = useKernel.getState().activity;
    const ev = events.find((item) => item.kind === "evidence.admitted");
    const fn = events.find((item) => item.kind === "finding.admitted");
    assert.ok(ev && fn);
    assert.equal(ev.evidenceId, evidence.id);
    assert.equal(fn.findingId, finding.id);
    assert.equal(ev.source, "admission");
    assert.equal(fn.source, "admission");
  });

  itSerial("5. revoke genera evento correcto", () => {
    const { finding } = seedCase();
    assert.equal(
      useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok,
      true,
    );
    const memory = useKernel.getState().memory[0];
    assert.ok(memory);
    useKernel.getState().forgetMemory(memory.id);
    const revoked = useKernel.getState().activity.find((item) => item.kind === "memory.revoked");
    assert.ok(revoked);
    assert.equal(revoked.memoryId, memory.id);
    assert.equal(revoked.source, "authority");
    assert.equal(useKernel.getState().memory.find((item) => item.id === memory.id)?.lifecycle, "revoked");
  });

  itSerial("6. supersession genera evento correcto", async () => {
    const { evidence, finding } = seedCase();
    assert.equal(
      useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok,
      true,
    );
    const m1 = useKernel.getState().memory[0];
    assert.ok(m1);
    const other = useKernel.getState().createGoal("Taladro listado a 80 euros");
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
    assert.equal(useKernel.getState().tryAdmitEvidence(otherEvidence).ok, true);
    assert.equal(useKernel.getState().tryAdmitFinding(otherFinding).ok, true);
    assert.equal(
      useKernel.getState().replaceTensedMemory(otherFinding.id, "Sustituye el precio anterior observado.").ok,
      true,
    );
    const superseded = useKernel.getState().activity.find((item) => item.kind === "memory.superseded");
    assert.ok(superseded);
    assert.equal(superseded.memoryId, m1.id);
    assert.equal(superseded.causal?.supersedes, m1.id);
  });

  itSerial("7. contradiction genera evento", () => {
    const { goalId, evidence } = seedCase();
    const later: Evidence = {
      ...evidence,
      id: `e2_${goalId}`,
      contentHash: "zzz123def4567890abcd",
      retrievedAt: T1,
      excerpt: "Taladro 22 EUR observado en la misma ficha.",
      title: "Taladro 22 EUR",
    };
    assert.equal(useKernel.getState().tryAdmitEvidence(later).ok, true);
    const row = useKernel.getState().activity.find((item) => item.kind === "contradiction.recorded");
    assert.ok(row);
    assert.equal(Boolean(row.contradictionId), true);
    assert.equal(row.source, "contradiction");
  });

  itSerial("8. learning genera evento", () => {
    const { finding } = seedCase();
    const candidate = useKernel.getState().learning.find((item) => item.findingIds.includes(finding.id));
    assert.ok(candidate);
    const observed = useKernel
      .getState()
      .activity.find((item) => item.kind === "learning.observed" || item.kind === "learning.validated");
    assert.ok(observed);
    assert.equal(observed.learningCandidateId, candidate.id);
  });

  itSerial("9. confidence genera evento", () => {
    const { finding } = seedCase();
    const row = useKernel.getState().confidence.find((item) => item.findingId === finding.id);
    assert.ok(row);
    const event = useKernel.getState().activity.find((item) => item.kind === "confidence.evaluated");
    assert.ok(event);
    assert.equal(event.confidenceId, row.id);
    assert.equal(event.source, "confidence");
  });

  itSerial("10. seal genera evento", async () => {
    const { evidence, finding, goalId } = seedCase();
    const goal = useKernel.getState().goals.find((item) => item.id === goalId);
    assert.ok(goal);
    const sealed = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(sealed);
    assert.equal(useKernel.getState().sealDossier(sealed).ok, true);
    const event = useKernel.getState().activity.find((item) => item.kind === "dossier.sealed");
    assert.ok(event);
    assert.equal(event.dossierId, sealed.id);
    assert.equal(event.source, "seal");
  });

  itSerial("11. replay genera evento sin mutar estado", async () => {
    const { evidence, finding, goalId } = seedCase();
    const goal = useKernel.getState().goals.find((item) => item.id === goalId);
    assert.ok(goal);
    const sealed = await composeDossier({
      goal,
      findings: [finding],
      evidence: [evidence],
      related: [],
    });
    assert.ok(sealed);
    assert.equal(useKernel.getState().sealDossier(sealed).ok, true);
    const before = structuredClone({
      dossiers: useKernel.getState().dossiers,
      memory: useKernel.getState().memory,
      evidence: useKernel.getState().evidence,
      findings: useKernel.getState().findings,
      contradictions: useKernel.getState().contradictions,
      confidence: useKernel.getState().confidence,
    });
    const first = useKernel.getState().replaySeal(sealed.id);
    const after = {
      dossiers: useKernel.getState().dossiers,
      memory: useKernel.getState().memory,
      evidence: useKernel.getState().evidence,
      findings: useKernel.getState().findings,
      contradictions: useKernel.getState().contradictions,
      confidence: useKernel.getState().confidence,
    };
    assert.deepEqual(after, before);
    assert.equal(first.status, "complete");
    const replayed = useKernel.getState().activity.find((item) => item.kind === "dossier.replayed");
    assert.ok(replayed);
    assert.equal(replayed.dossierId, sealed.id);
    assert.equal(replayed.causal?.next, "complete");
  });

  it("12. eventos históricos son inmutables", () => {
    const first = appendActivity([], draft({ kind: "goal.created", summary: "Objetivo creado", goalId: "g1" }), {
      now: T0,
      nextId: () => "a1",
    });
    const snapshot = structuredClone(first.created);
    const second = appendActivity(first.events, draft({ kind: "evidence.admitted", summary: "Evidencia", goalId: "g1", evidenceId: "e1" }), {
      now: T1,
      nextId: () => "a2",
    });
    const kept = second.events.find((item) => item.id === "a1");
    assert.deepEqual(kept, snapshot);
    assert.equal(overwriteActivity(snapshot!, { summary: "alterado" }).ok, false);
  });

  itSerial("13. operación repetida es idempotente", () => {
    const { evidence } = seedCase();
    const first = useKernel.getState().activity.filter((item) => item.kind === "evidence.admitted").length;
    const again = useKernel.getState().tryAdmitEvidence(evidence);
    assert.equal(again.ok, false);
    const second = useKernel.getState().activity.filter((item) => item.kind === "evidence.admitted").length;
    assert.equal(second, first);
  });

  it("14. evento duplicado no corrompe estado", () => {
    const once = appendActivity([], draft({ kind: "goal.created", summary: "Objetivo creado", goalId: "g1" }), {
      now: T0,
      nextId: () => "a1",
    });
    const twice = appendActivity(once.events, draft({ kind: "goal.created", summary: "Objetivo creado", goalId: "g1" }), {
      now: T1,
      nextId: () => "a2",
    });
    assert.equal(twice.created, undefined);
    assert.equal(twice.events.length, 1);
    assert.equal(twice.events[0]?.id, "a1");
  });

  it("15. referencias inválidas son detectadas", () => {
    const report = inspectKernel(
      emptyKernel({
        findings: [
          {
            id: "f1",
            goalId: "g-missing",
            title: "x",
            answer: "y",
            whyItMatters: "z",
            confidence: "low",
            evidenceIds: ["e-missing"],
            uncertainties: [],
            nextAction: "",
            interpretationAvailable: false,
            createdAt: T0,
          },
        ],
      }),
      T0,
    );
    assert.equal(report.status, "degraded");
    assert.equal(report.issues.some((item) => item.code === "missing-evidence"), true);
    assert.equal(report.issues.some((item) => item.code === "broken-ref"), true);
  });

  it("16. lineage roto es detectado", () => {
    const report = inspectKernel(
      emptyKernel({
        goals: [
          {
            id: "g1",
            text: "caso",
            createdAt: T0,
            updatedAt: T0,
            status: "complete",
            stage: "complete",
            evidenceIds: [],
            findingIds: [],
            leadCount: 0,
            leads: [],
            watched: false,
          },
        ],
        dossiers: [
          {
            id: "d2",
            goalId: "g1",
            sealedAt: T1,
            sealHash: "hash-d2-abcdef123456",
            executive: "lectura",
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
            supersedesId: "d1-missing",
          },
        ],
      }),
      T1,
    );
    assert.equal(report.status, "degraded");
    assert.equal(report.issues.some((item) => item.code === "broken-seal-lineage"), true);
  });

  it("17. provenance rota es detectada", () => {
    const report = inspectKernel(
      emptyKernel({
        learning: [
          {
            id: "l1",
            createdAt: T0,
            status: "open",
            relation: "novel",
            title: "sin origen",
            proposal: "no debería existir",
            origin: {
              kind: "finding",
              note: "",
              goalIds: [],
              findingIds: [],
              evidenceIds: [],
              contradictionIds: [],
              sealIds: [],
              memoryIds: [],
            },
            evidenceIds: [],
            findingIds: [],
            caseIds: [],
            relatedMemoryIds: [],
            contradictionIds: [],
          },
        ],
      }),
      T0,
    );
    assert.equal(report.issues.some((item) => item.code === "learning-without-provenance"), true);
  });

  it("18. memoryId nunca aparece como evidenceId", () => {
    const report = inspectKernel(
      emptyKernel({
        evidence: [
          {
            id: "m1",
            goalId: "g1",
            url: "https://example.com/x",
            title: "no",
            sourceHost: "example.com",
            excerpt: "esto no es evidencia de memoria",
            contentHash: "hashxxxxxxxxxxxxxxxxxx",
            retrievedAt: T0,
            httpStatus: 200,
            bytes: 8,
            validation: "retrieved",
          },
        ],
        memory: [
          {
            id: "m1",
            findingId: "f1",
            goalId: "g1",
            title: "memoria",
            why: "razón suficiente",
            evidenceIds: [],
            admittedAt: T0,
            lifecycle: "admitted",
            informedGoalIds: [],
          },
        ],
      }),
      T0,
    );
    assert.equal(report.issues.some((item) => item.code === "memory-as-evidence"), true);
  });

  it("19. observabilidad nunca admite memoria", () => {
    const event = appendActivity([], draft({ kind: "memory.admitted", summary: "no", memoryId: "m1" }), {
      now: T0,
      nextId: () => "a1",
    }).created!;
    assert.equal(observabilityAdmitMemory(event).ok, false);
    assert.equal(KERNEL_OBSERVABILITY_BOUNDARIES.mayAdmitMemory, false);
  });

  it("20. observabilidad nunca modifica políticas", () => {
    assert.equal(mutatePoliciesFromObservability().ok, false);
    assert.equal(metricMutatePolicy().ok, false);
    assert.equal(KERNEL_OBSERVABILITY_BOUNDARIES.mayMutatePolicies, false);
  });

  it("21. health check detecta inconsistencia", () => {
    const report = inspectKernel(
      emptyKernel({
        confidence: [
          {
            id: "cf1",
            subjectKind: "finding",
            evidenceIds: [],
            memoryIds: [],
            contradictionIds: [],
            calculatedAt: T0,
            policyId: "confidence-v1",
            policyVersion: 1,
            algorithm: "efesto-support-v1",
            version: 1,
            score: 10,
            band: "very-low",
            reasons: [],
            inputHash: "{}",
          },
        ],
      }),
      T0,
    );
    assert.equal(report.status, "degraded");
    assert.equal(report.issues.some((item) => item.code === "confidence-without-subject"), true);
  });

  it("blocks writes on integrity errors and documents warning/revoke as fail-open", () => {
    assert.equal(OBSERVABILITY_FAILURE_POLICY.integrityFailure, "fail-closed");
    assert.equal(OBSERVABILITY_FAILURE_POLICY.integrityWarning, "fail-open");
    assert.equal(OBSERVABILITY_FAILURE_POLICY.revokeOnDegraded, "fail-open");
    assert.equal(assertKernelWritable(emptyKernel()).ok, true);
    const broken = emptyKernel({
      findings: [
        {
          id: "f1",
          goalId: "g-missing",
          title: "Roto",
          answer: "Cita un caso ausente.",
          whyItMatters: "Error de integridad.",
          confidence: "low",
          evidenceIds: ["e-missing"],
          uncertainties: [],
          nextAction: "",
          interpretationAvailable: false,
          createdAt: T0,
        },
      ],
    });
    assert.equal(integrityErrors(inspectKernel(broken)).length > 0, true);
    const gate = assertKernelWritable(broken);
    assert.equal(gate.ok, false);
    assert.match(gate.ok ? "" : gate.reason, /Integridad/);
  });

  it("22. health check no repara automáticamente", () => {
    const broken = emptyKernel({
      dossiers: [
        {
          id: "d2",
          goalId: "g1",
          sealedAt: T1,
          sealHash: "hash-d2-abcdef123456",
          executive: "lectura",
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
          supersedesId: "d1-missing",
        },
      ],
    });
    const snapshot = structuredClone(broken);
    const report = inspectKernel(broken, T1);
    assert.equal(report.status, "degraded");
    assert.deepEqual(broken, snapshot);
    assert.equal(repairKernel(broken).ok, false);
    assert.equal(KERNEL_OBSERVABILITY_BOUNDARIES.mayRepairAutomatically, false);
  });

  itSerial("23. métricas se derivan del historial", () => {
    const { finding } = seedCase();
    assert.equal(
      useKernel.getState().admitFindingToMemory(finding.id, "Útil para comprar luego.").ok,
      true,
    );
    const metrics = kernelMetrics(useKernel.getState());
    assert.equal(metrics.evidenceAdmitted >= 1, true);
    assert.equal(metrics.learningCandidates >= 1, true);
    assert.equal(metrics.confidenceEvaluations >= 1, true);
    assert.equal(metrics.memoryAdmitted, 1);
    assert.equal(typeof metrics.integrityErrors, "number");
  });

  itSerial("24. observabilidad no cambia el resultado de una operación válida", () => {
    const { evidence } = seedCase();
    const before = structuredClone(evidence);
    const metrics = kernelMetrics(useKernel.getState());
    assert.equal(KERNEL_OBSERVABILITY_BOUNDARIES.mayChangeOperationOutcome, false);
    assert.equal(OBSERVABILITY_FAILURE_POLICY.observabilityWriteFailure, "fail-open");
    assert.equal(OBSERVABILITY_FAILURE_POLICY.admissionFailure, "fail-closed");
    assert.deepEqual(useKernel.getState().evidence.find((item) => item.id === before.id), before);
    assert.equal(metrics.evidenceAdmitted >= 1, true);
  });
});

describe("observability security", () => {
  it("refuses observability → Memory Authority", () => {
    const event = appendActivity([], draft({ kind: "memory.proposed", summary: "x", memoryId: "m1" }), {
      now: T0,
      nextId: () => "a1",
    }).created!;
    assert.equal(observabilityAdmitMemory(event).ok, false);
  });

  it("refuses event → Evidence", () => {
    const event = appendActivity([], draft({ kind: "evidence.admitted", summary: "x", evidenceId: "e1" }), {
      now: T0,
      nextId: () => "a1",
    }).created!;
    assert.equal(eventAsEvidence(event).ok, false);
  });

  it("refuses event → Memory mutation", () => {
    const event = appendActivity([], draft({ kind: "memory.revoked", summary: "x", memoryId: "m1" }), {
      now: T0,
      nextId: () => "a1",
    }).created!;
    assert.equal(eventMutateMemory(event).ok, false);
  });

  it("refuses metric → policy mutation", () => {
    assert.equal(metricMutatePolicy().ok, false);
    assert.equal(mutateCodeFromObservability().ok, false);
  });

  it("refuses health check → automatic repair", () => {
    assert.equal(repairKernel(emptyKernel()).ok, false);
  });

  it("does not reuse activity ids", () => {
    const id = allocateActivityId([
      {
        id: "a_taken",
        at: T0,
        kind: "goal.created",
        actor: "operator",
        source: "investigation",
        summary: "x",
        correlationId: "g1",
      },
    ]);
    assert.equal(id === "a_taken", false);
    assert.match(id, /^a_/);
  });

  it("recordReplayActivity is idempotent and read-only toward the seal", () => {
    const result = replaySeal(emptyKernel(), "d-missing");
    const first = recordReplayActivity([], result, { now: T0, nextId: () => "a1" });
    const second = recordReplayActivity(first.events, result, { now: T2, nextId: () => "a2" });
    assert.equal(first.created?.kind, "dossier.replayed");
    assert.equal(second.created, undefined);
    assert.equal(second.events.length, 1);
    assert.equal(result.status, "incomplete");
  });

  it("fingerprints distinguish subjects", () => {
    const a = activityFingerprint({
      kind: "memory.admitted",
      correlationId: "g1",
      memoryId: "m1",
      summary: "Memoria admitida",
    });
    const b = activityFingerprint({
      kind: "memory.admitted",
      correlationId: "g1",
      memoryId: "m2",
      summary: "Memoria admitida",
    });
    assert.equal(a === b, false);
  });

  it("labels cover every activity kind", () => {
    assert.equal(Boolean(ACTIVITY_KIND_LABEL["dossier.replayed"]), true);
    assert.equal(Boolean(ACTIVITY_KIND_LABEL["memory.proposed"]), true);
    assert.equal(Boolean(ACTIVITY_KIND_LABEL["confidence.changed"]), true);
  });
});

describe("observability helpers", () => {
  it("reconstructs memory operational history in order", () => {
    const proposed = appendActivity([], draft({ kind: "memory.proposed", summary: "propuesta", memoryId: "m1", goalId: "g1" }), {
      now: T0,
      nextId: () => "a1",
    });
    const admitted = appendActivity(proposed.events, draft({ kind: "memory.admitted", summary: "admitida", memoryId: "m1", goalId: "g1" }), {
      now: T1,
      nextId: () => "a2",
    });
    const revoked = appendActivity(admitted.events, draft({ kind: "memory.revoked", summary: "revocada", memoryId: "m1", goalId: "g1" }), {
      now: T2,
      nextId: () => "a3",
    });
    const history = eventsForMemory(revoked.events, "m1");
    assert.deepEqual(
      history.map((item) => item.kind),
      ["memory.proposed", "memory.admitted", "memory.revoked"],
    );
  });
});
