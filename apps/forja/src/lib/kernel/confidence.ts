import { shortId } from "../utils.ts";
import { isAdmittedMemory, type GateResult } from "./authority.ts";
import type {
  ConfidenceBand,
  ConfidenceCaps,
  ConfidencePolicy,
  ConfidenceRecord,
  ConfidenceSignal,
  ConfidenceSignalKind,
  ConfidenceWeights,
  Contradiction,
  Evidence,
  Finding,
  LearningCandidate,
  MemoryRecord,
} from "./types.ts";

export const CONFIDENCE_ALGORITHM = "efesto-support-v1";

export const KERNEL_CONFIDENCE_BOUNDARIES = Object.freeze({
  mayAdmitMemory: false,
  mayTreatMemoryAsEvidence: false,
  mayOverwriteEvaluation: false,
  mayRecalculateOnReplay: false,
  mayUseLlmAsAuthority: false,
  mayMutatePolicies: false,
  mayMutateCode: false,
  mayMutateGates: false,
});

const WEIGHTS: ConfidenceWeights = Object.freeze({
  base: 18,
  independentSource: 14,
  independentSourceCap: 3,
  coverage: 10,
  stability: 8,
  quality: 8,
  concordant: 6,
  openEvidenceEvidence: -22,
  openEvidenceMemory: -14,
  openMemoryMemory: -10,
  interpretationShift: -4,
  resolvedContradiction: 4,
  resolvedCap: 2,
  liveMemorySupport: 8,
  incompleteProvenance: -20,
});

const CAPS: ConfidenceCaps = Object.freeze({
  min: 0,
  max: 100,
  incompleteProvenanceMax: 36,
  openEvidenceContradictionMax: 48,
});

export const CONFIDENCE_POLICY_V1: ConfidencePolicy = Object.freeze({
  id: "confidence-v1",
  version: 1,
  algorithm: CONFIDENCE_ALGORITHM,
  label: "Soporte del Kernel v1",
  weights: WEIGHTS,
  caps: CAPS,
});

export type ConfidenceDraft = Omit<ConfidenceRecord, "id" | "version" | "previousId" | "changeNote">;

export type ConfidenceInput = {
  finding: Finding;
  evidence: Evidence[];
  memory: MemoryRecord[];
  contradictions: Contradiction[];
  learning?: LearningCandidate[];
  sealId?: string;
  at: string;
  policy?: ConfidencePolicy;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function bandOf(score: number): ConfidenceBand {
  if (score < 20) return "very-low";
  if (score < 40) return "low";
  if (score < 60) return "medium";
  if (score < 80) return "high";
  return "very-high";
}

export function confidenceBandLabel(band: ConfidenceBand) {
  if (band === "very-low") return "muy bajo";
  if (band === "low") return "bajo";
  if (band === "medium") return "medio";
  if (band === "high") return "alto";
  return "muy alto";
}

export function confidenceSubjectKey(record: Pick<ConfidenceRecord, "subjectKind" | "findingId" | "sealId">) {
  if (record.subjectKind === "seal" && record.sealId) return `seal:${record.sealId}`;
  return `finding:${record.findingId ?? ""}`;
}

export function allocateConfidenceId(existing: ConfidenceRecord[]) {
  const taken = new Set(existing.map((item) => item.id));
  for (let i = 0; i < 12; i += 1) {
    const id = shortId("cf");
    if (!taken.has(id)) return id;
  }
  return `cf_${Date.now().toString(36)}_${existing.length}`;
}

export function observationAt(input: {
  finding: Finding;
  evidence: Evidence[];
  memory: MemoryRecord[];
  contradictions: Contradiction[];
}) {
  const times = [
    input.finding.createdAt,
    ...input.evidence.map((item) => item.retrievedAt),
    ...input.contradictions.map((item) => item.at),
    ...input.memory.map((item) => item.closedAt || item.admittedAt || item.proposedAt || ""),
  ].filter(Boolean);
  times.sort();
  return times[times.length - 1] || input.finding.createdAt;
}

function signal(
  kind: ConfidenceSignalKind,
  note: string,
  delta: number,
  refs?: Pick<ConfidenceSignal, "evidenceIds" | "memoryIds" | "contradictionIds">,
): ConfidenceSignal {
  return {
    kind,
    note,
    delta,
    evidenceIds: refs?.evidenceIds,
    memoryIds: refs?.memoryIds,
    contradictionIds: refs?.contradictionIds,
  };
}

function sortSignals(items: ConfidenceSignal[]) {
  return items.slice().sort((a, b) => {
    const kind = a.kind.localeCompare(b.kind);
    if (kind !== 0) return kind;
    const note = a.note.localeCompare(b.note);
    if (note !== 0) return note;
    return a.delta - b.delta;
  });
}

export function confidenceInputHash(input: {
  findingId: string;
  evidence: Array<{ id: string; contentHash: string; validation: string; sourceHost: string }>;
  memory: Array<{ id: string; lifecycle: string }>;
  contradictions: Array<{ id: string; kind: string; open: boolean }>;
  policyId: string;
  policyVersion: number;
}) {
  return JSON.stringify({
    findingId: input.findingId,
    evidence: input.evidence
      .map((item) => [item.id, item.contentHash, item.validation, item.sourceHost])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    memory: input.memory
      .map((item) => [item.id, item.lifecycle])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    contradictions: input.contradictions
      .map((item) => [item.id, item.kind, item.open])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    policyId: input.policyId,
    policyVersion: input.policyVersion,
  });
}

function boundEvidence(finding: Finding, evidence: Evidence[], memoryIds: Set<string>) {
  const cited = new Set(finding.evidenceIds);
  return evidence
    .filter((item) => cited.has(item.id) && !memoryIds.has(item.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

function contradictionsFor(
  finding: Finding,
  relatedIds: string[],
  contradictions: Contradiction[],
) {
  const evidenceIds = new Set(finding.evidenceIds);
  const memoryIds = new Set(relatedIds);
  return contradictions
    .filter((item) => {
      if (item.findingId === finding.id) return true;
      const poles = [item.left, item.right];
      if (poles.some((pole) => pole.kind === "evidence" && evidenceIds.has(pole.id))) return true;
      if (poles.some((pole) => pole.kind === "memory" && memoryIds.has(pole.id))) return true;
      return false;
    })
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id) || a.at.localeCompare(b.at));
}

export function computeConfidence(input: ConfidenceInput): ConfidenceDraft {
  const policy = input.policy ?? CONFIDENCE_POLICY_V1;
  const weights = policy.weights;
  const memoryIds = new Set(input.memory.map((item) => item.id));
  const bound = boundEvidence(input.finding, input.evidence, memoryIds);
  const retrieved = bound.filter((item) => item.validation === "retrieved");
  const relatedId = input.finding.deltaMemoryId;
  const related = relatedId ? input.memory.find((item) => item.id === relatedId) : undefined;
  const relatedIds = related ? [related.id] : [];
  const listed = contradictionsFor(input.finding, relatedIds, input.contradictions);
  const reasons: ConfidenceSignal[] = [];
  let incomplete = false;
  let openEvidenceContradiction = false;

  reasons.push(
    signal("independent-evidence", "Soporte base del Kernel. No es una medida de verdad.", weights.base),
  );

  const hosts = [...new Set(retrieved.map((item) => item.sourceHost))].sort((a, b) => a.localeCompare(b));
  const independent = Math.min(hosts.length, weights.independentSourceCap);
  if (independent > 0) {
    reasons.push(
      signal(
        "independent-evidence",
        independent === 1
          ? "Una fuente independiente observada."
          : `${independent} fuentes independientes observadas.`,
        independent * weights.independentSource,
        { evidenceIds: retrieved.map((item) => item.id) },
      ),
    );
  }

  const missingCited = input.finding.evidenceIds.filter(
    (id) => !memoryIds.has(id) && !input.evidence.some((item) => item.id === id),
  );
  if (input.finding.evidenceIds.length === 0 || retrieved.length === 0 || missingCited.length > 0) {
    incomplete = true;
    reasons.push(
      signal(
        "incomplete-provenance",
        missingCited.length
          ? "El hallazgo cita evidencia que el Kernel no retiene."
          : "No hay evidencia observada que cubra este hallazgo.",
        weights.incompleteProvenance,
        { evidenceIds: missingCited },
      ),
    );
  } else if (retrieved.length === bound.length) {
    reasons.push(
      signal("coverage", "La evidencia citada está retenida y recuperada.", weights.coverage, {
        evidenceIds: retrieved.map((item) => item.id),
      }),
    );
  }

  const openEvidenceEvidence = listed.filter((item) => item.kind === "evidence-evidence" && item.open);
  if (openEvidenceEvidence.length === 0 && retrieved.length > 0) {
    reasons.push(
      signal("stability", "Las huellas citadas no entran en contradicción de evidencia.", weights.stability, {
        evidenceIds: retrieved.map((item) => item.id),
      }),
    );
  }

  const qualityOk =
    retrieved.length > 0 &&
    retrieved.every((item) => item.validation === "retrieved" && item.httpStatus >= 200 && item.httpStatus < 300);
  if (qualityOk) {
    reasons.push(
      signal("quality", "Las fuentes citadas se recuperaron con respuesta válida.", weights.quality, {
        evidenceIds: retrieved.map((item) => item.id),
      }),
    );
  }

  if (independent >= 2 && openEvidenceEvidence.length === 0) {
    reasons.push(
      signal(
        "concordant-evidence",
        "Más de una fuente independiente concuerda. No se trata como prueba absoluta.",
        weights.concordant,
        { evidenceIds: retrieved.map((item) => item.id) },
      ),
    );
  }

  for (const item of openEvidenceEvidence) {
    openEvidenceContradiction = true;
    reasons.push(
      signal(
        "incompatible-evidence",
        "Contradicción de evidencia abierta. Reduce el soporte y permanece visible.",
        weights.openEvidenceEvidence,
        { contradictionIds: [item.id], evidenceIds: [item.left.id, item.right.id] },
      ),
    );
  }

  for (const item of listed.filter((row) => row.kind === "evidence-memory" && row.open)) {
    reasons.push(
      signal(
        "open-evidence-memory",
        "Evidencia contra memoria vigente. No se oculta aunque el soporte sea alto.",
        weights.openEvidenceMemory,
        { contradictionIds: [item.id], memoryIds: [item.left.kind === "memory" ? item.left.id : item.right.id] },
      ),
    );
  }

  for (const item of listed.filter((row) => row.kind === "memory-memory" && row.open)) {
    reasons.push(
      signal(
        "open-memory-memory",
        "Dos memorias vigentes entran en tensión. No equivale a evidencia contradictoria.",
        weights.openMemoryMemory,
        { contradictionIds: [item.id], memoryIds: [item.left.id, item.right.id] },
      ),
    );
  }

  for (const item of listed.filter((row) => row.kind === "interpretation-interpretation" && row.open)) {
    reasons.push(
      signal(
        "interpretation-shift",
        "Cambio de interpretación. No equivale a evidencia contra evidencia.",
        weights.interpretationShift,
        { contradictionIds: [item.id] },
      ),
    );
  }

  const resolved = listed.filter((item) => !item.open);
  const resolvedCount = Math.min(resolved.length, weights.resolvedCap);
  if (resolvedCount > 0) {
    reasons.push(
      signal(
        "resolved-contradiction",
        "Hay contradicciones ya cerradas. Se distinguen de las abiertas.",
        resolvedCount * weights.resolvedContradiction,
        { contradictionIds: resolved.map((item) => item.id) },
      ),
    );
  }

  if (related) {
    if (isAdmittedMemory(related)) {
      reasons.push(
        signal(
          "live-memory-support",
          "Memoria vigente respalda la lectura. La memoria no es evidencia.",
          weights.liveMemorySupport,
          { memoryIds: [related.id] },
        ),
      );
    } else if (related.lifecycle === "superseded") {
      reasons.push(
        signal(
          "superseded-memory",
          "La memoria sustituida no cuenta como soporte vigente.",
          0,
          { memoryIds: [related.id] },
        ),
      );
    } else if (related.lifecycle === "revoked") {
      reasons.push(
        signal(
          "revoked-memory",
          "La memoria revocada no cuenta como soporte vigente.",
          0,
          { memoryIds: [related.id] },
        ),
      );
    }
  }

  const newest = retrieved
    .slice()
    .sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt) || a.id.localeCompare(b.id))
    .at(-1);
  reasons.push(
    signal(
      "freshness",
      newest
        ? `La observación más reciente es de ${newest.retrievedAt}. La antigüedad no prueba ni refuta.`
        : "No hay observación fechada. La antigüedad no prueba ni refuta.",
      0,
      newest ? { evidenceIds: [newest.id] } : undefined,
    ),
  );

  const ordered = sortSignals(reasons);
  let score = ordered.reduce((sum, item) => sum + item.delta, 0);
  score = clamp(score, policy.caps.min, policy.caps.max);
  if (incomplete) score = Math.min(score, policy.caps.incompleteProvenanceMax);
  if (openEvidenceContradiction) score = Math.min(score, policy.caps.openEvidenceContradictionMax);

  const linked = (input.learning ?? []).find((item) => item.findingIds.includes(input.finding.id));
  const inputHash = confidenceInputHash({
    findingId: input.finding.id,
    evidence: bound,
    memory: related ? [{ id: related.id, lifecycle: related.lifecycle }] : [],
    contradictions: listed,
    policyId: policy.id,
    policyVersion: policy.version,
  });

  return {
    subjectKind: "finding",
    findingId: input.finding.id,
    sealId: input.sealId,
    evidenceIds: bound.map((item) => item.id),
    memoryIds: relatedIds,
    contradictionIds: listed.map((item) => item.id),
    learningCandidateId: linked?.id,
    calculatedAt: input.at,
    policyId: policy.id,
    policyVersion: policy.version,
    algorithm: policy.algorithm,
    score,
    band: bandOf(score),
    reasons: ordered,
    inputHash,
  };
}

export function deriveConfidence(input: {
  findings: Finding[];
  evidence: Evidence[];
  memory: MemoryRecord[];
  contradictions: Contradiction[];
  learning?: LearningCandidate[];
  atFor?: (finding: Finding) => string;
  policy?: ConfidencePolicy;
}): ConfidenceDraft[] {
  return input.findings
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((finding) => {
      const bound = boundEvidence(finding, input.evidence, new Set(input.memory.map((item) => item.id)));
      const related = finding.deltaMemoryId
        ? input.memory.filter((item) => item.id === finding.deltaMemoryId)
        : [];
      const listed = contradictionsFor(finding, related.map((item) => item.id), input.contradictions);
      const at =
        input.atFor?.(finding) ??
        observationAt({
          finding,
          evidence: bound,
          memory: related,
          contradictions: listed,
        });
      return computeConfidence({
        finding,
        evidence: input.evidence,
        memory: input.memory,
        contradictions: input.contradictions,
        learning: input.learning,
        at,
        policy: input.policy,
      });
    });
}

export function explainConfidenceChange(previous: ConfidenceRecord, next: ConfidenceRecord): string[] {
  const notes: string[] = [];
  if (previous.policyVersion !== next.policyVersion || previous.algorithm !== next.algorithm) {
    notes.push(
      `Algoritmo ${previous.algorithm} v${previous.policyVersion} → ${next.algorithm} v${next.policyVersion}.`,
    );
  }
  const prevEvidence = new Set(previous.evidenceIds);
  const nextEvidence = new Set(next.evidenceIds);
  const addedEvidence = next.evidenceIds.filter((id) => !prevEvidence.has(id));
  const removedEvidence = previous.evidenceIds.filter((id) => !nextEvidence.has(id));
  if (addedEvidence.length || removedEvidence.length) {
    notes.push("Cambió la evidencia observada.");
  }
  const prevHash = previous.reasons.find((item) => item.kind === "stability" || item.kind === "incompatible-evidence");
  const nextHash = next.reasons.find((item) => item.kind === "incompatible-evidence");
  if (!previous.reasons.some((item) => item.kind === "incompatible-evidence") && nextHash) {
    notes.push("Apareció evidencia contradictoria.");
  } else if (prevHash && previous.reasons.some((item) => item.kind === "incompatible-evidence") && !nextHash) {
    notes.push("Se cerró una contradicción de evidencia.");
  }
  const prevMemory = previous.reasons.find((item) => item.kind === "live-memory-support");
  const nextMemory = next.reasons.find((item) => item.kind === "live-memory-support");
  if (prevMemory && !nextMemory) {
    if (next.reasons.some((item) => item.kind === "revoked-memory")) {
      notes.push("Cambió la memoria: la vigencia se revocó.");
    } else if (next.reasons.some((item) => item.kind === "superseded-memory")) {
      notes.push("Cambió la memoria: fue sustituida.");
    } else {
      notes.push("Cambió la memoria que respaldaba la lectura.");
    }
  } else if (!prevMemory && nextMemory) {
    notes.push("Una memoria vigente pasó a respaldar la lectura.");
  } else if (previous.memoryIds.join() !== next.memoryIds.join()) {
    notes.push("Cambió la memoria involucrada.");
  }
  const prevOpen = previous.contradictionIds;
  const nextOpen = next.contradictionIds;
  if (prevOpen.join() !== nextOpen.join()) {
    if (next.reasons.some((item) => item.kind === "interpretation-shift") &&
      !next.reasons.some((item) => item.kind === "incompatible-evidence")) {
      notes.push("Cambió la interpretación. No equivale a evidencia contra evidencia.");
    } else if (!addedEvidence.length && !removedEvidence.length) {
      notes.push("Cambió el estado de una contradicción.");
    }
  }
  if (previous.score !== next.score) {
    notes.push(`Soporte ${previous.score} → ${next.score}.`);
  }
  return notes;
}

export function mergeConfidence(
  existing: ConfidenceRecord[],
  derived: ConfidenceDraft[],
  opts: { now: string; nextId: () => string },
): { records: ConfidenceRecord[]; created: ConfidenceRecord[] } {
  const latest = new Map<string, ConfidenceRecord>();
  for (const item of existing) {
    const key = confidenceSubjectKey(item);
    const prev = latest.get(key);
    if (!prev || item.version > prev.version || (item.version === prev.version && item.calculatedAt > prev.calculatedAt)) {
      latest.set(key, item);
    }
  }
  const created: ConfidenceRecord[] = [];
  for (const draft of derived) {
    const key = confidenceSubjectKey(draft);
    const previous = latest.get(key);
    if (previous && previous.inputHash === draft.inputHash && previous.policyVersion === draft.policyVersion) {
      continue;
    }
    const asRecord: ConfidenceRecord = {
      ...draft,
      id: opts.nextId(),
      version: previous ? previous.version + 1 : 1,
      previousId: previous?.id,
      changeNote: previous ? explainConfidenceChange(previous, { ...previous, ...draft, id: "next", version: (previous.version + 1) }).join(" ") : undefined,
    };
    created.push(asRecord);
    latest.set(key, asRecord);
  }
  const records = [...created, ...existing].sort((a, b) => {
    const at = b.calculatedAt.localeCompare(a.calculatedAt);
    if (at !== 0) return at;
    if (a.findingId && b.findingId && a.findingId === b.findingId) return b.version - a.version;
    return a.id.localeCompare(b.id);
  });
  return { records, created };
}

export function latestConfidence(records: ConfidenceRecord[], findingId: string) {
  return records
    .filter((item) => item.findingId === findingId)
    .slice()
    .sort((a, b) => b.version - a.version || b.calculatedAt.localeCompare(a.calculatedAt) || a.id.localeCompare(b.id))[0];
}

export function confidenceHistory(records: ConfidenceRecord[], findingId: string) {
  return records
    .filter((item) => item.findingId === findingId)
    .slice()
    .sort((a, b) => b.version - a.version || b.calculatedAt.localeCompare(a.calculatedAt) || a.id.localeCompare(b.id));
}

export function openSupportConflicts(record: Pick<ConfidenceRecord, "reasons">) {
  return record.reasons.filter(
    (item) =>
      item.kind === "incompatible-evidence" ||
      item.kind === "open-evidence-memory" ||
      item.kind === "open-memory-memory" ||
      item.kind === "interpretation-shift",
  );
}

/** Negative: confidence cannot mint admitted memory. */
export function confidenceAdmitMemory(_record: ConfidenceRecord): GateResult<MemoryRecord> {
  return { ok: false, reason: "La confianza no admite memoria. Solo Memory Authority." };
}

export function memoryIdAsEvidenceFromConfidence(_memoryId: string): GateResult<Evidence> {
  return { ok: false, reason: "La memoria no es evidencia." };
}

export function overwriteEvaluation(
  _record: ConfidenceRecord,
  _patch: Partial<ConfidenceRecord>,
): GateResult<ConfidenceRecord> {
  return { ok: false, reason: "Una evaluación histórica no se sobrescribe. Se crea una versión nueva." };
}

export function recalculateOnReplay(
  _record: ConfidenceRecord,
  _policy: ConfidencePolicy,
): GateResult<ConfidenceRecord> {
  return { ok: false, reason: "Replay no recalcula confianza. Restaura la evaluación de entonces." };
}

export function llmConfidenceAuthority(): GateResult<never> {
  return { ok: false, reason: "El modelo no es la autoridad de confianza." };
}

export function mutatePoliciesFromConfidence(): GateResult<never> {
  return { ok: false, reason: "Confidence Engine no modifica políticas del Kernel." };
}

export function mutateCodeFromConfidence(): GateResult<never> {
  return { ok: false, reason: "Confidence Engine no modifica código ni configuración." };
}

export function confidenceSkipAuthority(_record: ConfidenceRecord): GateResult<MemoryRecord> {
  return { ok: false, reason: "Un candidato con soporte alto sigue pasando por Memory Authority." };
}
