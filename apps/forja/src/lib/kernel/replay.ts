import { currentSeal, sealCause, sealChangeNote, sealLineage } from "./dossier.ts";
import type { SealCause } from "./dossier.ts";
import { contradictionAsOf } from "./contradiction.ts";
import { activityAtSeal } from "./observability.ts";
import type {
  ActivityEvent,
  ConfidenceRecord,
  Contradiction,
  Dossier,
  Evidence,
  Finding,
  KernelState,
  KnownMemorySnapshot,
  LearningCandidate,
  LearningDecision,
  MemoryDecision,
  MemoryLifecycle,
} from "./types.ts";

export const HISTORIAL_INSUFICIENTE = "Historial insuficiente";

export type ReplayStatus = "complete" | "incomplete";

export type ReplayGapField = "seal" | "goal" | "evidence" | "finding" | "lineage";

export type ReplayGap = {
  field: ReplayGapField;
  id?: string;
  why: string;
};

export type ReplayMemoryConsult = {
  memoryId: string;
  title: string;
  findingId: string;
  goalId: string;
  admittedAt: string;
  lifecycleAtConsult: MemoryLifecycle;
  whyHash: string;
  consultedAt: string;
};

export type ReplayLineageEntry = {
  sealId: string;
  sealHash: string;
  sealedAt: string;
  supersedesId?: string;
  consultedMemoryIds: string[];
  evidenceHashes: string[];
  causeFromPrevious?: SealCause;
  changeNote?: string;
};

export type ReplayProvenance = {
  findingIds: string[];
  evidenceIds: string[];
  evidenceHashes: string[];
  sourceHosts: string[];
  consultedMemoryIds: string[];
  influencedFindingMemoryIds: string[];
  closedBySealId: string;
  closedBySealHash: string;
};

export type ReplaySource = Pick<
  KernelState,
  | "goals"
  | "evidence"
  | "findings"
  | "memory"
  | "memoryDecisions"
  | "dossiers"
  | "contradictions"
> & {
  learning?: LearningCandidate[];
  learningDecisions?: LearningDecision[];
  confidence?: ConfidenceRecord[];
  activity?: ActivityEvent[];
};

export type ReplayLearning = {
  candidates: LearningCandidate[];
  decisions: LearningDecision[];
};

export type ReplayResult = {
  status: ReplayStatus;
  note: string | null;
  sealId: string;
  sealHash?: string;
  sealedAt?: string;
  memoryContextHash?: string;
  executive?: string;
  goal?: { id: string; text: string };
  evidence: Evidence[];
  findings: Finding[];
  memory: ReplayMemoryConsult[];
  decisions: MemoryDecision[];
  contradictions: Contradiction[];
  lineage: ReplayLineageEntry[];
  previous?: ReplayLineageEntry;
  provenance: ReplayProvenance;
  learning: ReplayLearning;
  confidence: ConfidenceRecord[];
  activity: ActivityEvent[];
  missing: ReplayGap[];
  reconstructed: string[];
};

export function replaySource(state: ReplaySource): ReplaySource {
  return {
    goals: state.goals,
    evidence: state.evidence,
    findings: state.findings,
    memory: state.memory,
    memoryDecisions: state.memoryDecisions ?? [],
    dossiers: state.dossiers,
    contradictions: state.contradictions ?? [],
    learning: state.learning ?? [],
    learningDecisions: state.learningDecisions ?? [],
    confidence: state.confidence ?? [],
    activity: state.activity ?? [],
  };
}

export function kernelFingerprint(state: ReplaySource) {
  const src = replaySource(state);
  return JSON.stringify({
    goals: src.goals,
    evidence: src.evidence,
    findings: src.findings,
    memory: src.memory,
    memoryDecisions: src.memoryDecisions,
    dossiers: src.dossiers,
    contradictions: src.contradictions,
    learning: src.learning,
    learningDecisions: src.learningDecisions,
    confidence: src.confidence,
  });
}

function byIdThenAt<T extends { id: string; at?: string }>(a: T, b: T) {
  const at = (a.at ?? "").localeCompare(b.at ?? "");
  return at !== 0 ? at : a.id.localeCompare(b.id);
}

function emptyProvenance(sealId: string): ReplayProvenance {
  return {
    findingIds: [],
    evidenceIds: [],
    evidenceHashes: [],
    sourceHosts: [],
    consultedMemoryIds: [],
    influencedFindingMemoryIds: [],
    closedBySealId: sealId,
    closedBySealHash: "",
  };
}

function consultFromSnapshot(item: KnownMemorySnapshot): ReplayMemoryConsult {
  return {
    memoryId: item.memoryId,
    title: item.title,
    findingId: item.findingId,
    goalId: item.goalId,
    admittedAt: item.admittedAt,
    lifecycleAtConsult: item.lifecycle,
    whyHash: item.whyHash,
    consultedAt: item.consultedAt,
  };
}

function decisionsAtSeal(
  decisions: MemoryDecision[],
  memoryIds: string[],
  sealedAt: string,
): MemoryDecision[] {
  const ids = new Set(memoryIds);
  return decisions
    .filter((item) => ids.has(item.memoryId) && item.at <= sealedAt)
    .slice()
    .sort(byIdThenAt);
}

function lineageForCase(dossiers: Dossier[], dossier: Dossier): Dossier[] {
  const head = currentSeal(dossiers, dossier.goalId);
  if (head) {
    const chain = sealLineage(dossiers, head).slice().reverse();
    if (chain.some((item) => item.id === dossier.id)) return chain;
  }
  return sealLineage(dossiers, dossier).slice().reverse();
}

function lineageEntries(chain: Dossier[]): ReplayLineageEntry[] {
  return chain.map((item, index) => {
    const older = index > 0 ? chain[index - 1] : undefined;
    return {
      sealId: item.id,
      sealHash: item.sealHash,
      sealedAt: item.sealedAt,
      supersedesId: item.supersedesId,
      consultedMemoryIds: item.known.map((row) => row.memoryId),
      evidenceHashes: item.evidenceHashes.slice(),
      causeFromPrevious: older ? sealCause(item, older) : undefined,
      changeNote: older ? sealChangeNote(item, older) : undefined,
    };
  });
}

function contradictionTouchesSeal(item: Contradiction, dossier: Dossier) {
  if (item.sealId === dossier.id) return true;
  if (item.left.id === dossier.id || item.right.id === dossier.id) return true;
  if (item.findingId && dossier.findingIds.includes(item.findingId)) return true;
  const evidenceIds = new Set(dossier.evidenceIds);
  const memoryIds = new Set(dossier.known.map((row) => row.memoryId));
  const poles = [item.left, item.right];
  if (poles.some((pole) => pole.kind === "evidence" && evidenceIds.has(pole.id))) return true;
  if (poles.some((pole) => pole.kind === "memory" && memoryIds.has(pole.id))) return true;
  if (poles.some((pole) => pole.kind === "seal" && pole.id === dossier.id)) return true;
  return false;
}

function contradictionsAtSeal(
  contradictions: Contradiction[],
  dossier: Dossier,
): Contradiction[] {
  return contradictions
    .filter((item) => item.at <= dossier.sealedAt && contradictionTouchesSeal(item, dossier))
    .map((item) => contradictionAsOf(item, dossier.sealedAt))
    .filter((item): item is Contradiction => Boolean(item))
    .slice()
    .sort(byIdThenAt);
}

function learningAtSeal(src: ReplaySource, dossier: Dossier): ReplayLearning {
  const candidates = (src.learning ?? [])
    .filter((item) => {
      if (item.createdAt > dossier.sealedAt) return false;
      if (item.caseIds.includes(dossier.goalId)) return true;
      if (item.findingIds.some((id) => dossier.findingIds.includes(id))) return true;
      if (item.evidenceIds.some((id) => dossier.evidenceIds.includes(id))) return true;
      if (item.origin.sealIds.includes(dossier.id)) return true;
      if (item.relatedMemoryIds.some((id) => dossier.known.some((row) => row.memoryId === id))) {
        return true;
      }
      return false;
    })
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const ids = new Set(candidates.map((item) => item.id));
  const decisions = (src.learningDecisions ?? [])
    .filter((item) => ids.has(item.candidateId) && item.at <= dossier.sealedAt)
    .slice()
    .sort(byIdThenAt);
  const historic = candidates.map((item) => {
    const chain = decisions.filter((row) => row.candidateId === item.id);
    const last = chain[chain.length - 1];
    const closedAfter =
      item.closedAt && item.closedAt > dossier.sealedAt ? undefined : item.closedAt;
    const memoryAfter =
      last?.memoryId && (last.to === "admitted" || last.to === "proposed")
        ? last.memoryId
        : undefined;
    return {
      ...item,
      status: last?.to ?? "open",
      memoryId: memoryAfter,
      closedAt: closedAfter,
    };
  });
  return { candidates: historic, decisions };
}

function emptyLearning(): ReplayLearning {
  return { candidates: [], decisions: [] };
}

/**
 * Restore evaluations calculated at or before the seal. Never recompute.
 * Never substitute the live policy, live memory, or a later score.
 */
function confidenceAtSeal(src: ReplaySource, dossier: Dossier): ConfidenceRecord[] {
  const relevant = (src.confidence ?? [])
    .filter((item) => {
      if (item.calculatedAt > dossier.sealedAt) return false;
      if (item.sealId === dossier.id) return true;
      if (item.findingId && dossier.findingIds.includes(item.findingId)) return true;
      if (item.evidenceIds.some((id) => dossier.evidenceIds.includes(id))) return true;
      return false;
    })
    .slice()
    .sort(
      (a, b) =>
        a.calculatedAt.localeCompare(b.calculatedAt) ||
        a.version - b.version ||
        a.id.localeCompare(b.id),
    );
  const bySubject = new Map<string, ConfidenceRecord>();
  for (const item of relevant) {
    const key = item.findingId ? `finding:${item.findingId}` : `seal:${item.sealId ?? ""}`;
    const prev = bySubject.get(key);
    if (!prev || item.version > prev.version || (item.version === prev.version && item.calculatedAt >= prev.calculatedAt)) {
      bySubject.set(key, item);
    }
  }
  return [...bySubject.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function resolveBound<T extends { id: string }>(
  ids: string[],
  pool: T[],
  field: "evidence" | "finding",
  why: string,
): { rows: T[]; missing: ReplayGap[] } {
  const byId = new Map(pool.map((item) => [item.id, item]));
  const rows: T[] = [];
  const missing: ReplayGap[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (row) rows.push(row);
    else missing.push({ field, id, why });
  }
  return { rows, missing };
}

/**
 * Historical reconstruction of a sealed case. Read-only. No network, no LLM,
 * no live memory substitution, no kernel mutation, no confidence recalculation.
 */
export function replaySeal(state: ReplaySource, sealId: string): ReplayResult {
  const src = replaySource(state);
  const dossier = src.dossiers.find((item) => item.id === sealId);

  if (!dossier) {
    return {
      status: "incomplete",
      note: HISTORIAL_INSUFICIENTE,
      sealId,
      evidence: [],
      findings: [],
      memory: [],
      decisions: [],
      contradictions: [],
      lineage: [],
      provenance: emptyProvenance(sealId),
      learning: emptyLearning(),
      confidence: [],
      activity: [],
      missing: [
        {
          field: "seal",
          id: sealId,
          why: "No hay un sello con ese identificador.",
        },
      ],
      reconstructed: [],
    };
  }

  const missing: ReplayGap[] = [];
  const reconstructed: string[] = ["sello"];

  const goal = src.goals.find((item) => item.id === dossier.goalId);
  if (!goal) {
    missing.push({
      field: "goal",
      id: dossier.goalId,
      why: "El caso de origen no está en el Kernel.",
    });
  } else {
    reconstructed.push("caso");
  }

  const boundEvidence = resolveBound(
    dossier.evidenceIds,
    src.evidence,
    "evidence",
    "El sello cita evidencia que el Kernel no retiene.",
  );
  missing.push(...boundEvidence.missing);
  if (!boundEvidence.missing.length && dossier.evidenceIds.length) reconstructed.push("evidencia");

  const boundFindings = resolveBound(
    dossier.findingIds,
    src.findings,
    "finding",
    "El sello cita un hallazgo que el Kernel no retiene.",
  );
  missing.push(...boundFindings.missing);
  if (!boundFindings.missing.length && dossier.findingIds.length) reconstructed.push("hallazgos");

  if (dossier.supersedesId && !src.dossiers.some((item) => item.id === dossier.supersedesId)) {
    missing.push({
      field: "lineage",
      id: dossier.supersedesId,
      why: "El sello anterior no está en el Kernel.",
    });
  }

  const memory = dossier.known.map(consultFromSnapshot);
  if (dossier.known.length) reconstructed.push("memoria consultada");

  const consultedIds = memory.map((item) => item.memoryId);
  const decisions = decisionsAtSeal(src.memoryDecisions, consultedIds, dossier.sealedAt);
  if (decisions.length) reconstructed.push("decisiones");

  const contradictions = contradictionsAtSeal(src.contradictions, dossier);
  if (contradictions.length) reconstructed.push("contradicciones");

  const learning = learningAtSeal(src, dossier);
  if (learning.candidates.length) reconstructed.push("aprendizaje");

  const confidence = confidenceAtSeal(src, dossier);
  if (confidence.length) reconstructed.push("confianza");

  const activity = activityAtSeal(src.activity ?? [], dossier.sealedAt, {
    goalId: dossier.goalId,
    sealId: dossier.id,
  });
  if (activity.length) reconstructed.push("actividad");

  const chain = lineageForCase(src.dossiers, dossier);
  const lineage = lineageEntries(chain);
  if (lineage.length) reconstructed.push("linaje");
  const replayedIndex = lineage.findIndex((item) => item.sealId === dossier.id);
  const previous = replayedIndex > 0 ? lineage[replayedIndex - 1] : undefined;

  const influencedFindingMemoryIds = [
    ...new Set(
      boundFindings.rows
        .map((item) => item.deltaMemoryId)
        .filter((id): id is string => Boolean(id)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  const provenance: ReplayProvenance = {
    findingIds: dossier.findingIds.slice(),
    evidenceIds: dossier.evidenceIds.slice(),
    evidenceHashes: dossier.evidenceHashes.slice(),
    sourceHosts: dossier.sourceHosts.slice().sort((a, b) => a.localeCompare(b)),
    consultedMemoryIds: consultedIds.slice(),
    influencedFindingMemoryIds,
    closedBySealId: dossier.id,
    closedBySealHash: dossier.sealHash,
  };

  const result: ReplayResult = {
    status: missing.length ? "incomplete" : "complete",
    note: missing.length ? HISTORIAL_INSUFICIENTE : null,
    sealId: dossier.id,
    sealHash: dossier.sealHash,
    sealedAt: dossier.sealedAt,
    memoryContextHash: dossier.memoryContextHash,
    executive: dossier.executive,
    goal: goal ? { id: goal.id, text: goal.text } : undefined,
    evidence: boundEvidence.rows,
    findings: boundFindings.rows,
    memory,
    decisions,
    contradictions,
    lineage,
    previous,
    provenance,
    learning,
    confidence,
    activity,
    missing,
    reconstructed,
  };
  return result;
}

export function replayUsesMemory(result: ReplayResult, memoryId: string) {
  return result.memory.some((item) => item.memoryId === memoryId);
}

/** Present-tense reinterpretation is a different operation. Replay never selects it. */
export function replayIsReinterpretation(_result: ReplayResult) {
  return false;
}
