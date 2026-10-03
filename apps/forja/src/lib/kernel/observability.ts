import { shortId } from "../utils.ts";
import { canTransition, type GateResult } from "./authority.ts";
import { polesAreValid } from "./contradiction.ts";
import type {
  ActivityCausal,
  ActivityEvent,
  ActivityKind,
  ActivityRefs,
  Evidence,
  KernelActor,
  KernelComponent,
  KernelState,
  MemoryRecord,
} from "./types.ts";
import type { ReplayResult } from "./replay.ts";

export const KERNEL_OBSERVABILITY_BOUNDARIES = Object.freeze({
  mayAdmitMemory: false,
  mayCreateEvidence: false,
  mayMutateMemory: false,
  mayMutatePolicies: false,
  mayMutateCode: false,
  mayRepairAutomatically: false,
  mayChangeOperationOutcome: false,
});

/** Visual/recording faults never block a valid kernel operation. Kernel faults stay fail-closed. */
export const OBSERVABILITY_FAILURE_POLICY = Object.freeze({
  admissionFailure: "fail-closed",
  contradictionFailure: "fail-closed",
  provenanceFailure: "fail-closed",
  replayFailure: "fail-closed",
  /** Errors of integrity block writes. Warnings do not. */
  integrityFailure: "fail-closed",
  /** Historical memory / weak correlation: degraded, but the Kernel still writes. */
  integrityWarning: "fail-open",
  /** Revoke/forget remains available so a degraded Kernel is not a trap. */
  revokeOnDegraded: "fail-open",
  observabilityWriteFailure: "fail-open",
});

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  "goal.created": "Objetivo",
  "search.completed": "Búsqueda",
  "search.blocked": "Búsqueda bloqueada",
  "evidence.admitted": "Evidencia",
  "evidence.rejected": "Evidencia rechazada",
  "finding.admitted": "Hallazgo",
  "memory.proposed": "Memoria propuesta",
  "memory.admitted": "Memoria",
  "memory.forgotten": "Olvido",
  "memory.revoked": "Revocación",
  "memory.superseded": "Sustitución",
  "memory.rejected": "Memoria rechazada",
  "memory.quarantined": "Cuarentena",
  "memory.consulted": "Memoria consultada",
  "dossier.sealed": "Dosier",
  "dossier.replayed": "Replay",
  "contradiction.recorded": "Contradicción",
  "contradiction.resolved": "Contradicción cerrada",
  "learning.observed": "Aprendizaje",
  "learning.validated": "Aprendizaje validado",
  "learning.blocked": "Aprendizaje sin soporte",
  "learning.duplicate": "Aprendizaje duplicado",
  "learning.reinforced": "Refuerzo",
  "learning.proposed": "Aprendizaje propuesto",
  "learning.rejected": "Aprendizaje rechazado",
  "confidence.evaluated": "Soporte",
  "confidence.changed": "Soporte cambió",
  "watch.completed": "Relectura",
  "research.blocked": "Bloqueado",
  "research.failed": "Fallido",
  "chat.message": "Conversación",
  "ai.completed": "Modelo",
  "ai.failed": "Modelo falló",
  "ai.fallback": "Modelo alternativo",
};

export type ActivityDraft = {
  kind: ActivityKind;
  summary: string;
  actor?: KernelActor;
  source?: KernelComponent;
  correlationId?: string;
  goalId?: string;
  evidenceId?: string;
  findingId?: string;
  dossierId?: string;
  memoryId?: string;
  contradictionId?: string;
  learningCandidateId?: string;
  confidenceId?: string;
  provenance?: ActivityRefs;
  causal?: ActivityCausal;
  policy?: string;
  ai?: ActivityEvent["ai"];
  id?: string;
  at?: string;
};

export type HealthIssueCode =
  | "broken-ref"
  | "missing-memory"
  | "missing-evidence"
  | "invalid-contradiction-pole"
  | "learning-without-provenance"
  | "confidence-without-subject"
  | "broken-seal-lineage"
  | "impossible-authority-transition"
  | "invalid-correlation"
  | "duplicate-event"
  | "memory-as-evidence"
  | "duplicate-entity-id";

export type HealthIssue = {
  code: HealthIssueCode;
  severity: "warning" | "error";
  note: string;
  field?: string;
  id?: string;
};

export type HealthReport = {
  status: "healthy" | "degraded";
  issues: HealthIssue[];
  checkedAt: string;
};

export type KernelMetrics = {
  investigationsCompleted: number;
  evidenceAdmitted: number;
  evidenceRejected: number;
  contradictionsOpen: number;
  contradictionsResolved: number;
  memoryAdmitted: number;
  memoryRevoked: number;
  memorySuperseded: number;
  learningCandidates: number;
  confidenceEvaluations: number;
  sealsCreated: number;
  replayComplete: number;
  replayIncomplete: number;
  operationsBlocked: number;
  integrityErrors: number;
};

const PREDECESSOR: Partial<Record<ActivityKind, ActivityKind[]>> = {
  "search.completed": ["goal.created"],
  "evidence.admitted": ["search.completed", "goal.created"],
  "evidence.rejected": ["goal.created"],
  "finding.admitted": ["evidence.admitted"],
  "learning.observed": ["finding.admitted"],
  "learning.validated": ["learning.observed"],
  "learning.proposed": ["learning.validated", "learning.observed"],
  "learning.rejected": ["learning.proposed", "learning.observed"],
  "memory.proposed": ["finding.admitted", "learning.proposed"],
  "memory.admitted": ["memory.proposed", "finding.admitted"],
  "memory.superseded": ["memory.admitted"],
  "memory.revoked": ["memory.admitted"],
  "memory.rejected": ["memory.proposed"],
  "contradiction.recorded": ["finding.admitted", "evidence.admitted"],
  "contradiction.resolved": ["contradiction.recorded"],
  "confidence.evaluated": ["finding.admitted"],
  "confidence.changed": ["confidence.evaluated", "confidence.changed"],
  "dossier.sealed": ["finding.admitted", "memory.consulted"],
  "dossier.replayed": ["dossier.sealed"],
  "ai.completed": ["goal.created", "finding.admitted", "chat.message"],
  "ai.failed": ["goal.created", "chat.message"],
  "ai.fallback": ["ai.failed", "goal.created"],
};

export function defaultActor(kind: ActivityKind): KernelActor {
  if (kind === "dossier.replayed") return "replay";
  if (
    kind.startsWith("memory.") &&
    kind !== "memory.consulted" &&
    kind !== "memory.proposed"
  ) {
    return "operator";
  }
  if (kind === "goal.created") return "operator";
  if (kind === "learning.rejected") return "operator";
  return "kernel";
}

export function defaultSource(kind: ActivityKind): KernelComponent {
  if (kind.startsWith("memory.")) return kind === "memory.consulted" ? "seal" : "authority";
  if (kind.startsWith("learning.")) return "learning";
  if (kind.startsWith("confidence.")) return "confidence";
  if (kind.startsWith("contradiction.")) return "contradiction";
  if (kind.startsWith("dossier.")) return kind === "dossier.replayed" ? "replay" : "seal";
  if (kind === "watch.completed") return "watch";
  if (kind === "chat.message") return "chat";
  if (kind.startsWith("ai.")) return "ai";
  if (kind === "evidence.admitted" || kind === "evidence.rejected" || kind === "finding.admitted") {
    return "admission";
  }
  return "investigation";
}

export function defaultCorrelation(draft: ActivityDraft, fallbackId: string) {
  return (
    draft.correlationId ||
    draft.goalId ||
    draft.findingId ||
    draft.memoryId ||
    draft.dossierId ||
    draft.evidenceId ||
    draft.learningCandidateId ||
    draft.confidenceId ||
    fallbackId
  );
}

export function activityFingerprint(
  event: Pick<
    ActivityEvent,
    | "kind"
    | "correlationId"
    | "evidenceId"
    | "findingId"
    | "memoryId"
    | "dossierId"
    | "contradictionId"
    | "learningCandidateId"
    | "confidenceId"
    | "summary"
  >,
) {
  return JSON.stringify([
    event.kind,
    event.correlationId,
    event.evidenceId ?? "",
    event.findingId ?? "",
    event.memoryId ?? "",
    event.dossierId ?? "",
    event.contradictionId ?? "",
    event.learningCandidateId ?? "",
    event.confidenceId ?? "",
    event.summary,
  ]);
}

export function allocateActivityId(existing: ActivityEvent[]) {
  const taken = new Set(existing.map((item) => item.id));
  for (let i = 0; i < 12; i += 1) {
    const id = shortId("a");
    if (!taken.has(id)) return id;
  }
  return `a_${Date.now().toString(36)}_${existing.length}`;
}

function inferCausal(existing: ActivityEvent[], draft: ActivityDraft): ActivityCausal | undefined {
  const causal: ActivityCausal = { ...draft.causal };
  if (!causal.causedBy) {
    const wanted = PREDECESSOR[draft.kind] ?? [];
    const correlation = draft.correlationId || draft.goalId;
    const match = existing.find((item) => {
      if (!wanted.includes(item.kind)) return false;
      if (draft.memoryId && item.memoryId && item.memoryId === draft.memoryId) return true;
      if (draft.findingId && item.findingId && item.findingId === draft.findingId) return true;
      if (draft.contradictionId && item.contradictionId === draft.contradictionId) return true;
      if (draft.confidenceId && item.findingId && draft.findingId && item.findingId === draft.findingId) {
        return true;
      }
      if (draft.dossierId && item.dossierId === draft.dossierId) return true;
      if (correlation && item.correlationId === correlation) return true;
      return false;
    });
    if (match) causal.causedBy = match.id;
  }
  if (!causal.triggeredBy) {
    causal.triggeredBy =
      draft.learningCandidateId ||
      draft.findingId ||
      draft.evidenceId ||
      draft.memoryId ||
      draft.dossierId;
  }
  const keys = Object.keys(causal).filter((key) => causal[key as keyof ActivityCausal]);
  return keys.length ? causal : undefined;
}

export function normalizeActivity(
  event: Partial<ActivityEvent> & Pick<ActivityEvent, "id" | "at" | "kind" | "summary">,
): ActivityEvent {
  const actor = event.actor ?? defaultActor(event.kind);
  const source = event.source ?? defaultSource(event.kind);
  const correlationId = defaultCorrelation(event, event.id);
  return {
    id: event.id,
    at: event.at,
    kind: event.kind,
    actor,
    source,
    summary: event.summary,
    correlationId,
    goalId: event.goalId,
    evidenceId: event.evidenceId,
    findingId: event.findingId,
    dossierId: event.dossierId,
    memoryId: event.memoryId,
    contradictionId: event.contradictionId,
    learningCandidateId: event.learningCandidateId,
    confidenceId: event.confidenceId,
    provenance: event.provenance,
    causal: event.causal,
    policy: event.policy,
    ai: event.ai,
  };
}

export function appendActivity(
  existing: ActivityEvent[],
  draft: ActivityDraft,
  opts: { now: string; nextId: () => string },
): { events: ActivityEvent[]; created?: ActivityEvent } {
  const id = draft.id && !existing.some((item) => item.id === draft.id) ? draft.id : opts.nextId();
  const correlationId = defaultCorrelation(draft, id);
  const fingerprint = activityFingerprint({
    kind: draft.kind,
    correlationId,
    evidenceId: draft.evidenceId,
    findingId: draft.findingId,
    memoryId: draft.memoryId,
    dossierId: draft.dossierId,
    contradictionId: draft.contradictionId,
    learningCandidateId: draft.learningCandidateId,
    confidenceId: draft.confidenceId,
    summary: draft.summary,
  });
  const duplicate = existing.find((item) => activityFingerprint(item) === fingerprint);
  if (duplicate) return { events: existing };
  const created = normalizeActivity({
    ...draft,
    id,
    at: draft.at ?? opts.now,
    actor: draft.actor ?? defaultActor(draft.kind),
    source: draft.source ?? defaultSource(draft.kind),
    correlationId,
    causal: inferCausal(existing, { ...draft, correlationId }),
  });
  return { events: [created, ...existing], created };
}

export function recordReplayActivity(
  existing: ActivityEvent[],
  result: ReplayResult,
  opts: { now: string; nextId: () => string },
) {
  return appendActivity(
    existing,
    {
      kind: "dossier.replayed",
      actor: "replay",
      source: "replay",
      summary:
        result.status === "complete"
          ? `Replay completo de ${result.sealId}`
          : `Replay incompleto: ${result.note ?? "Historial insuficiente"}`,
      goalId: result.goal?.id,
      dossierId: result.sealId,
      correlationId: result.goal?.id ?? result.sealId,
      provenance: {
        sealIds: [result.sealId],
        hashes: result.sealHash ? [result.sealHash] : [],
        evidenceIds: result.provenance.evidenceIds,
        findingIds: result.provenance.findingIds,
        memoryIds: result.provenance.consultedMemoryIds,
      },
      causal: {
        triggeredBy: result.sealId,
        derivedFrom: result.provenance.evidenceIds,
        next: result.status,
      },
    },
    opts,
  );
}

export function eventsTouching(
  events: ActivityEvent[],
  ref: {
    memoryId?: string;
    sealId?: string;
    findingId?: string;
    evidenceId?: string;
    goalId?: string;
    correlationId?: string;
    learningCandidateId?: string;
    contradictionId?: string;
    confidenceId?: string;
  },
) {
  return events.filter((item) => {
    if (ref.correlationId && item.correlationId === ref.correlationId) return true;
    if (ref.goalId && item.goalId === ref.goalId) return true;
    if (ref.findingId && (item.findingId === ref.findingId || item.provenance?.findingIds?.includes(ref.findingId))) {
      return true;
    }
    if (ref.evidenceId && (item.evidenceId === ref.evidenceId || item.provenance?.evidenceIds?.includes(ref.evidenceId))) {
      return true;
    }
    if (
      ref.memoryId &&
      (item.memoryId === ref.memoryId ||
        item.provenance?.memoryIds?.includes(ref.memoryId) ||
        item.causal?.supersedes === ref.memoryId)
    ) {
      return true;
    }
    if (ref.sealId && (item.dossierId === ref.sealId || item.provenance?.sealIds?.includes(ref.sealId))) {
      return true;
    }
    if (ref.learningCandidateId && item.learningCandidateId === ref.learningCandidateId) return true;
    if (ref.contradictionId && item.contradictionId === ref.contradictionId) return true;
    if (ref.confidenceId && item.confidenceId === ref.confidenceId) return true;
    return false;
  });
}

export function eventsForMemory(events: ActivityEvent[], memoryId: string) {
  return eventsTouching(events, { memoryId }).slice().reverse();
}

export function eventsForSeal(events: ActivityEvent[], sealId: string) {
  return eventsTouching(events, { sealId }).slice().reverse();
}

export function eventsForCorrelation(events: ActivityEvent[], correlationId: string) {
  return eventsTouching(events, { correlationId }).slice().reverse();
}

export function causalChain(events: ActivityEvent[], seedId: string) {
  const byId = new Map(events.map((item) => [item.id, item]));
  const seed = byId.get(seedId);
  if (!seed) return [];
  const seen = new Set<string>();
  const walk: ActivityEvent[] = [];
  let current: ActivityEvent | undefined = seed;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    walk.push(current);
    current = current.causal?.causedBy ? byId.get(current.causal.causedBy) : undefined;
  }
  const children = events.filter(
    (item) => item.causal?.causedBy && seen.has(item.causal.causedBy) && !seen.has(item.id),
  );
  for (const child of children) {
    seen.add(child.id);
    walk.push(child);
  }
  const related = events.filter(
    (item) => item.correlationId === seed.correlationId && !seen.has(item.id),
  );
  return [...walk, ...related].sort(
    (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
  );
}

function issue(
  code: HealthIssueCode,
  note: string,
  extra?: { field?: string; id?: string; severity?: "warning" | "error" },
): HealthIssue {
  return {
    code,
    note,
    severity: extra?.severity ?? "error",
    field: extra?.field,
    id: extra?.id,
  };
}

export function inspectKernel(state: Pick<KernelState, keyof KernelState>, at = ""): HealthReport {
  const issues: HealthIssue[] = [];
  const evidenceIds = new Set(state.evidence.map((item) => item.id));
  const memoryIds = new Set(state.memory.map((item) => item.id));
  const findingIds = new Set(state.findings.map((item) => item.id));
  const goalIds = new Set(state.goals.map((item) => item.id));
  const sealIds = new Set(state.dossiers.map((item) => item.id));
  const contradictionIds = new Set((state.contradictions ?? []).map((item) => item.id));
  const learningIds = new Set((state.learning ?? []).map((item) => item.id));
  const confidenceIds = new Set((state.confidence ?? []).map((item) => item.id));
  const eventIds = new Set((state.activity ?? []).map((item) => item.id));

  const seenEvidence = new Set<string>();
  for (const item of state.evidence) {
    if (seenEvidence.has(item.id)) {
      issues.push(issue("duplicate-entity-id", "Hay dos evidencias con el mismo identificador.", { field: "evidence", id: item.id }));
    }
    seenEvidence.add(item.id);
    if (memoryIds.has(item.id)) {
      issues.push(issue("memory-as-evidence", "Un identificador de memoria aparece como evidencia.", { field: "evidence", id: item.id }));
    }
  }

  const seenMemory = new Set<string>();
  for (const item of state.memory) {
    if (seenMemory.has(item.id)) {
      issues.push(issue("duplicate-entity-id", "Hay dos memorias con el mismo identificador.", { field: "memory", id: item.id }));
    }
    seenMemory.add(item.id);
    if (!findingIds.has(item.findingId)) {
      issues.push(issue("broken-ref", "La memoria cita un hallazgo que el Kernel no retiene.", { field: "memory.findingId", id: item.findingId }));
    }
    for (const evidenceId of item.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push(issue("missing-evidence", "La memoria cita evidencia ausente.", { field: "memory.evidenceIds", id: evidenceId }));
      }
      if (memoryIds.has(evidenceId)) {
        issues.push(issue("memory-as-evidence", "La memoria usa un memoryId como evidenceId.", { field: "memory.evidenceIds", id: evidenceId }));
      }
    }
    if (item.supersedesId && !memoryIds.has(item.supersedesId)) {
      issues.push(issue("missing-memory", "La memoria sustituye un identificador que no está en el Kernel.", { field: "memory.supersedesId", id: item.supersedesId }));
    }
  }

  for (const finding of state.findings) {
    if (!goalIds.has(finding.goalId)) {
      issues.push(issue("broken-ref", "El hallazgo cita un caso ausente.", { field: "finding.goalId", id: finding.goalId }));
    }
    for (const evidenceId of finding.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push(issue("missing-evidence", "El hallazgo cita evidencia ausente.", { field: "finding.evidenceIds", id: evidenceId }));
      }
      if (memoryIds.has(evidenceId)) {
        issues.push(issue("memory-as-evidence", "El hallazgo usa un memoryId como evidenceId.", { field: "finding.evidenceIds", id: evidenceId }));
      }
    }
    if (finding.deltaMemoryId && !memoryIds.has(finding.deltaMemoryId)) {
      const historic = state.dossiers.some((dossier) =>
        dossier.known.some((row) => row.memoryId === finding.deltaMemoryId),
      );
      if (!historic) {
        issues.push(issue("missing-memory", "El hallazgo tensiona una memoria que el Kernel no retiene.", { field: "finding.deltaMemoryId", id: finding.deltaMemoryId, severity: "warning" }));
      }
    }
  }

  for (const dossier of state.dossiers) {
    if (dossier.supersedesId && !sealIds.has(dossier.supersedesId)) {
      issues.push(issue("broken-seal-lineage", "El sello apunta a un predecesor ausente.", { field: "dossier.supersedesId", id: dossier.supersedesId }));
    }
    for (const evidenceId of dossier.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) {
        issues.push(issue("missing-evidence", "El sello cita evidencia ausente.", { field: "dossier.evidenceIds", id: evidenceId }));
      }
    }
    for (const findingId of dossier.findingIds) {
      if (!findingIds.has(findingId)) {
        issues.push(issue("broken-ref", "El sello cita un hallazgo ausente.", { field: "dossier.findingIds", id: findingId }));
      }
    }
    for (const snap of dossier.known) {
      if (!memoryIds.has(snap.memoryId)) {
        issues.push(issue("missing-memory", "El sello consulta una memoria que el Kernel no retiene.", { field: "dossier.known", id: snap.memoryId, severity: "warning" }));
      }
    }
  }

  for (const item of state.contradictions ?? []) {
    if (!polesAreValid(item)) {
      issues.push(issue("invalid-contradiction-pole", "La contradicción no tiene polos válidos.", { field: "contradiction", id: item.id }));
    }
    for (const pole of [item.left, item.right]) {
      if (pole.kind === "evidence" && !evidenceIds.has(pole.id)) {
        issues.push(issue("missing-evidence", "Un polo de evidencia no existe.", { field: "contradiction", id: pole.id }));
      }
      if (pole.kind === "memory" && !memoryIds.has(pole.id)) {
        const historic = state.dossiers.some((dossier) => dossier.known.some((row) => row.memoryId === pole.id));
        if (!historic) {
          issues.push(issue("missing-memory", "Un polo de memoria no existe.", { field: "contradiction", id: pole.id, severity: "warning" }));
        }
      }
      if (pole.kind === "seal" && !sealIds.has(pole.id)) {
        issues.push(issue("broken-ref", "Un polo de sello no existe.", { field: "contradiction", id: pole.id }));
      }
    }
  }

  for (const item of state.learning ?? []) {
    const hasOrigin =
      item.evidenceIds.length > 0 ||
      item.findingIds.length > 0 ||
      item.origin.evidenceIds.length > 0 ||
      item.origin.findingIds.length > 0;
    if (!hasOrigin) {
      issues.push(issue("learning-without-provenance", "El candidato de aprendizaje no tiene procedencia.", { field: "learning", id: item.id }));
    }
  }

  for (const item of state.confidence ?? []) {
    const subjectOk =
      (item.findingId && findingIds.has(item.findingId)) ||
      (item.sealId && sealIds.has(item.sealId));
    if (!subjectOk) {
      issues.push(issue("confidence-without-subject", "La evaluación de soporte no tiene un sujeto válido.", { field: "confidence", id: item.id }));
    }
  }

  for (const decision of state.memoryDecisions ?? []) {
    if (!memoryIds.has(decision.memoryId)) {
      issues.push(issue("missing-memory", "Una decisión de Memory Authority cita memoria ausente.", { field: "memoryDecision", id: decision.memoryId }));
    }
    if (decision.from && !canTransition(decision.from, decision.to)) {
      issues.push(
        issue("impossible-authority-transition", `Transición imposible: ${decision.from} → ${decision.to}.`, {
          field: "memoryDecision",
          id: decision.id,
        }),
      );
    }
  }

  const seenEvents = new Set<string>();
  for (const event of state.activity ?? []) {
    if (seenEvents.has(event.id)) {
      issues.push(issue("duplicate-event", "Hay dos eventos con el mismo identificador.", { field: "activity", id: event.id }));
    }
    seenEvents.add(event.id);
    const known =
      (event.goalId && goalIds.has(event.goalId)) ||
      (event.findingId && findingIds.has(event.findingId)) ||
      (event.evidenceId && evidenceIds.has(event.evidenceId)) ||
      (event.memoryId && memoryIds.has(event.memoryId)) ||
      (event.dossierId && sealIds.has(event.dossierId)) ||
      (event.contradictionId && contradictionIds.has(event.contradictionId)) ||
      (event.learningCandidateId && learningIds.has(event.learningCandidateId)) ||
      (event.confidenceId && confidenceIds.has(event.confidenceId)) ||
      eventIds.has(event.correlationId) ||
      goalIds.has(event.correlationId) ||
      sealIds.has(event.correlationId) ||
      memoryIds.has(event.correlationId) ||
      findingIds.has(event.correlationId) ||
      event.correlationId === event.id;
    if (event.correlationId && !known) {
      issues.push(issue("invalid-correlation", "El evento no correlaciona con ninguna entidad del Kernel.", { field: "activity", id: event.id, severity: "warning" }));
    }
    if (event.memoryId && event.evidenceId && event.memoryId === event.evidenceId) {
      issues.push(issue("memory-as-evidence", "El evento trata memoria como evidencia.", { field: "activity", id: event.id }));
    }
    if (event.evidenceId && memoryIds.has(event.evidenceId)) {
      issues.push(issue("memory-as-evidence", "El evento usa un memoryId como evidenceId.", { field: "activity", id: event.id }));
    }
  }

  return {
    status: issues.some((item) => item.severity === "error") || issues.length ? (issues.length ? "degraded" : "healthy") : "healthy",
    issues,
    checkedAt: at,
  };
}

export function integrityErrors(report: HealthReport) {
  return report.issues.filter((item) => item.severity === "error");
}

/** Writes fail when integrity errors exist. Warnings do not block. Replay is read-only and is not gated here. */
export function assertKernelWritable(
  state: Pick<KernelState, keyof KernelState>,
): GateResult<true> {
  if (OBSERVABILITY_FAILURE_POLICY.integrityFailure !== "fail-closed") {
    return { ok: true, value: true };
  }
  const errors = integrityErrors(inspectKernel(state));
  if (!errors.length) return { ok: true, value: true };
  return {
    ok: false,
    reason: `Integridad del Kernel: ${errors[0]?.note ?? "estado inconsistente."}`,
  };
}

export function kernelMetrics(state: KernelState): KernelMetrics {
  const activity = state.activity ?? [];
  const count = (kind: ActivityKind) => activity.filter((item) => item.kind === kind).length;
  const health = inspectKernel(state);
  return {
    investigationsCompleted: state.goals.filter((item) => item.status === "complete").length,
    evidenceAdmitted: count("evidence.admitted"),
    evidenceRejected: count("evidence.rejected"),
    contradictionsOpen: (state.contradictions ?? []).filter((item) => item.open).length,
    contradictionsResolved: (state.contradictions ?? []).filter((item) => !item.open).length,
    memoryAdmitted: state.memory.filter((item) => item.lifecycle === "admitted").length,
    memoryRevoked: state.memory.filter((item) => item.lifecycle === "revoked").length,
    memorySuperseded: state.memory.filter((item) => item.lifecycle === "superseded").length,
    learningCandidates: (state.learning ?? []).length,
    confidenceEvaluations: (state.confidence ?? []).length,
    sealsCreated: state.dossiers.length,
    replayComplete: activity.filter((item) => item.kind === "dossier.replayed" && item.causal?.next === "complete").length,
    replayIncomplete: activity.filter((item) => item.kind === "dossier.replayed" && item.causal?.next === "incomplete").length,
    operationsBlocked:
      count("research.blocked") +
      count("research.failed") +
      count("evidence.rejected") +
      count("memory.rejected") +
      count("learning.blocked") +
      count("learning.rejected"),
    integrityErrors: health.issues.filter((item) => item.severity === "error").length,
  };
}

export function activityAtSeal(events: ActivityEvent[], sealedAt: string, ref: { goalId?: string; sealId?: string }) {
  return events
    .filter((item) => {
      if (item.at > sealedAt) return false;
      if (ref.sealId && (item.dossierId === ref.sealId || item.provenance?.sealIds?.includes(ref.sealId))) return true;
      if (ref.goalId && item.goalId === ref.goalId) return true;
      return false;
    })
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

export function observabilityAdmitMemory(_event: ActivityEvent): GateResult<MemoryRecord> {
  return { ok: false, reason: "La observabilidad no admite memoria. Solo Memory Authority." };
}

export function eventAsEvidence(_event: ActivityEvent): GateResult<Evidence> {
  return { ok: false, reason: "Un evento no es evidencia." };
}

export function eventMutateMemory(_event: ActivityEvent): GateResult<MemoryRecord> {
  return { ok: false, reason: "Un evento no muta memoria." };
}

export function metricMutatePolicy(): GateResult<never> {
  return { ok: false, reason: "Una métrica no modifica políticas del Kernel." };
}

export function repairKernel(_state: KernelState): GateResult<KernelState> {
  return { ok: false, reason: "El health check detecta. No repara." };
}

export function overwriteActivity(
  _event: ActivityEvent,
  _patch: Partial<ActivityEvent>,
): GateResult<ActivityEvent> {
  return { ok: false, reason: "Un evento histórico no se sobrescribe. Se registra uno nuevo." };
}

export function mutatePoliciesFromObservability(): GateResult<never> {
  return { ok: false, reason: "Observabilidad no modifica políticas del Kernel." };
}

export function mutateCodeFromObservability(): GateResult<never> {
  return { ok: false, reason: "Observabilidad no modifica código ni configuración." };
}
