import { shortId } from "../utils.ts";
import type {
  Contradiction,
  Dossier,
  Evidence,
  Finding,
  MemoryActor,
  MemoryDecision,
  MemoryLifecycle,
  MemoryPolicy,
  MemoryRecord,
} from "./types.ts";

export type GateResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

const TRANSITIONS: Record<MemoryLifecycle, MemoryLifecycle[]> = {
  proposed: ["quarantined", "admitted", "rejected"],
  quarantined: ["admitted", "rejected", "revoked"],
  admitted: ["superseded", "revoked"],
  superseded: [],
  revoked: [],
  rejected: [],
};

export function isLiveMemory(record: MemoryRecord) {
  return record.lifecycle === "admitted" || record.lifecycle === "quarantined";
}

export function isAdmittedMemory(record: MemoryRecord) {
  return record.lifecycle === "admitted";
}

export function liveMemory(memory: MemoryRecord[]) {
  return memory.filter(isLiveMemory);
}

export function admittedMemory(memory: MemoryRecord[]) {
  return memory.filter(isAdmittedMemory);
}

export function canTransition(from: MemoryLifecycle, to: MemoryLifecycle) {
  return TRANSITIONS[from].includes(to);
}

export function allocateMemoryId(existing: MemoryRecord[], evidence: Evidence[] = []) {
  const taken = new Set([
    ...existing.map((item) => item.id),
    ...evidence.map((item) => item.id),
  ]);
  for (let i = 0; i < 12; i += 1) {
    const id = shortId("m");
    if (!taken.has(id)) return id;
  }
  return `m_${Date.now().toString(36)}_${existing.length}`;
}

export function buildProposedMemory(input: {
  id: string;
  finding: Finding;
  why: string;
  at: string;
  supersedesId?: string;
  candidateId?: string;
}): MemoryRecord {
  return {
    id: input.id,
    findingId: input.finding.id,
    goalId: input.finding.goalId,
    title: input.finding.title,
    why: input.why.trim(),
    evidenceIds: input.finding.evidenceIds,
    proposedAt: input.at,
    admittedAt: "",
    lifecycle: "proposed",
    informedGoalIds: [],
    supersedesId: input.supersedesId,
    candidateId: input.candidateId,
  };
}

export function transitionMemory(
  record: MemoryRecord,
  to: MemoryLifecycle,
  input: {
    at: string;
    why: string;
    actor: MemoryActor;
    policy: MemoryPolicy;
    decisionId: string;
    relatedMemoryId?: string;
  },
): GateResult<{ record: MemoryRecord; decision: MemoryDecision }> {
  if (!canTransition(record.lifecycle, to)) {
    return {
      ok: false,
      reason: `Memory Authority no permite ${record.lifecycle} → ${to}.`,
    };
  }
  const next: MemoryRecord = {
    ...record,
    lifecycle: to,
    admittedAt: to === "admitted" ? input.at : record.admittedAt,
    closedAt:
      to === "superseded" || to === "revoked" || to === "rejected" ? input.at : record.closedAt,
    supersededById: to === "superseded" ? input.relatedMemoryId ?? record.supersededById : record.supersededById,
  };
  const decision: MemoryDecision = {
    id: input.decisionId,
    memoryId: record.id,
    at: input.at,
    from: record.lifecycle,
    to,
    why: input.why.trim(),
    actor: input.actor,
    policy: input.policy,
    findingId: record.findingId,
    evidenceIds: record.evidenceIds,
    relatedMemoryId: input.relatedMemoryId,
    candidateId: record.candidateId,
  };
  return { ok: true, value: { record: next, decision } };
}

export function proposeDecision(
  record: MemoryRecord,
  input: { at: string; decisionId: string; why?: string },
): MemoryDecision {
  return {
    id: input.decisionId,
    memoryId: record.id,
    at: input.at,
    from: null,
    to: "proposed",
    why: input.why?.trim() || "Propuesta a partir de un hallazgo admitido.",
    actor: "kernel",
    policy: "kernel-propose",
    findingId: record.findingId,
    evidenceIds: record.evidenceIds,
    relatedMemoryId: record.supersedesId,
    candidateId: record.candidateId,
  };
}

export function memoryLineage(memory: MemoryRecord[], memoryId: string): MemoryRecord[] {
  const byId = new Map(memory.map((item) => [item.id, item]));
  const start = byId.get(memoryId);
  if (!start) return [];
  let root = start;
  const seen = new Set<string>();
  while (root.supersedesId && !seen.has(root.id)) {
    seen.add(root.id);
    const prior = byId.get(root.supersedesId);
    if (!prior) break;
    root = prior;
  }
  const chain: MemoryRecord[] = [];
  let cursor: MemoryRecord | undefined = root;
  const walked = new Set<string>();
  while (cursor && !walked.has(cursor.id)) {
    walked.add(cursor.id);
    chain.push(cursor);
    cursor = cursor.supersededById ? byId.get(cursor.supersededById) : undefined;
  }
  return chain;
}

export function sealsUsingMemory(dossiers: Dossier[], memoryId: string) {
  return dossiers.filter((item) => item.known.some((row) => row.memoryId === memoryId));
}

export function explainMemory(input: {
  memoryId: string;
  memory: MemoryRecord[];
  decisions: MemoryDecision[];
  dossiers: Dossier[];
  contradictions: Contradiction[];
}) {
  const record = input.memory.find((item) => item.id === input.memoryId);
  if (!record) return null;
  const decisions = input.decisions
    .filter((item) => item.memoryId === record.id)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const seals = sealsUsingMemory(input.dossiers, record.id).map((dossier) => {
    const snap = dossier.known.find((item) => item.memoryId === record.id);
    return {
      sealId: dossier.id,
      sealHash: dossier.sealHash,
      sealedAt: dossier.sealedAt,
      lifecycleAtConsult: snap?.lifecycle,
      whyHash: snap?.whyHash,
    };
  });
  const lineage = memoryLineage(input.memory, record.id);
  return {
    id: record.id,
    title: record.title,
    why: record.why,
    lifecycle: record.lifecycle,
    proposedAt: record.proposedAt,
    admittedAt: record.admittedAt,
    closedAt: record.closedAt,
    findingId: record.findingId,
    evidenceIds: record.evidenceIds,
    decisions,
    lineage: lineage.map((item) => item.id),
    supersedesId: record.supersedesId,
    supersededById: record.supersededById,
    usedBySeals: seals,
    contradictions: input.contradictions.filter(
      (item) =>
        (item.left.kind === "memory" && item.left.id === record.id) ||
        (item.right.kind === "memory" && item.right.id === record.id),
    ),
  };
}
