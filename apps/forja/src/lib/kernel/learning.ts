import { shortId } from "../utils.ts";
import { admitMemory } from "./admission.ts";
import {
  admittedMemory,
  buildProposedMemory,
  canTransition,
  isAdmittedMemory,
  proposeDecision,
  transitionMemory,
  type GateResult,
} from "./authority.ts";
import { contradictionKey } from "./contradiction.ts";
import { relatedMemory, tokenize } from "./related-memory.ts";
import type {
  Contradiction,
  ContradictionDraft,
  Evidence,
  Finding,
  LearningActor,
  LearningCandidate,
  LearningDecision,
  LearningOrigin,
  LearningPolicy,
  LearningRelation,
  LearningStatus,
  MemoryDecision,
  MemoryRecord,
} from "./types.ts";

export const KERNEL_LEARNING_BOUNDARIES = Object.freeze({
  mayMutatePolicies: false,
  mayMutateCode: false,
  mayMutateGates: false,
  maySkipAuthority: false,
  mayTreatMemoryAsEvidence: false,
});

const MODEL_THOUGHT = /el modelo pens[oó]|the model thought|\bllm\b/i;

const CLOSED: LearningStatus[] = ["proposed", "admitted", "rejected"];

export type LearningDraft = Omit<
  LearningCandidate,
  "id" | "createdAt" | "status" | "closedAt" | "memoryId"
> & {
  key: string;
  contradictionDraft?: ContradictionDraft;
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function learningKey(input: {
  originKind: LearningOrigin["kind"];
  relation?: LearningRelation;
  findingId?: string;
  memoryId?: string;
  evidenceId?: string;
  contradictionId?: string;
}) {
  if (input.findingId) return `${input.originKind}:finding:${input.findingId}`;
  if (input.contradictionId) return `${input.originKind}:contradiction:${input.contradictionId}`;
  return [input.originKind, input.evidenceId ?? "", input.memoryId ?? ""].join(":");
}

export function learningOriginLabel(kind: LearningOrigin["kind"]) {
  if (kind === "pattern") return "patrón entre casos";
  if (kind === "contradiction") return "contradicción";
  if (kind === "evidence-change") return "cambio de evidencia";
  if (kind === "historical-result") return "resultado histórico";
  if (kind === "operator-feedback") return "decisión del operador";
  if (kind === "kernel-signal") return "señal del Kernel";
  return "hallazgo";
}

export function allocateLearningId(existing: LearningCandidate[]) {
  const taken = new Set(existing.map((item) => item.id));
  for (let i = 0; i < 12; i += 1) {
    const id = shortId("l");
    if (!taken.has(id)) return id;
  }
  return `l_${Date.now().toString(36)}_${existing.length}`;
}

function originOf(input: {
  kind: LearningOrigin["kind"];
  note: string;
  finding?: Finding;
  evidenceIds?: string[];
  memoryIds?: string[];
  contradictionIds?: string[];
  sealIds?: string[];
}): LearningOrigin {
  return {
    kind: input.kind,
    note: input.note,
    goalIds: input.finding ? [input.finding.goalId] : [],
    findingIds: input.finding ? [input.finding.id] : [],
    evidenceIds: input.evidenceIds ?? input.finding?.evidenceIds ?? [],
    contradictionIds: input.contradictionIds ?? [],
    sealIds: input.sealIds ?? [],
    memoryIds: input.memoryIds ?? [],
  };
}

export function classifyFinding(
  finding: Finding,
  memory: MemoryRecord[],
): { relation: LearningRelation; related?: MemoryRecord } {
  const related = finding.deltaMemoryId
    ? memory.find((item) => item.id === finding.deltaMemoryId)
    : undefined;
  if (finding.delta === "tension" && related) {
    return { relation: "contradiction", related };
  }
  if (finding.delta === "confirmed" && related && isAdmittedMemory(related)) {
    return { relation: "reinforcement", related };
  }
  const admitted = admittedMemory(memory);
  const title = normalize(finding.title);
  const answer = normalize(finding.answer);
  const duplicate = admitted.find(
    (item) =>
      item.findingId === finding.id ||
      (normalize(item.title) === title && (normalize(item.why) === answer || normalize(item.why).includes(answer))),
  );
  if (duplicate) return { relation: "duplicate", related: duplicate };
  if (related && isAdmittedMemory(related) && finding.delta === "novel") {
    return { relation: "refinement", related };
  }
  return { relation: "novel", related };
}

export function validateLearning(
  candidate: Pick<
    LearningCandidate,
    "origin" | "proposal" | "evidenceIds" | "relatedMemoryIds" | "relation" | "findingIds"
  >,
  input: { evidence: Evidence[]; memory: MemoryRecord[]; findings: Finding[] },
): GateResult<true> {
  if (!candidate.origin.kind) {
    return { ok: false, reason: "El aprendizaje exige un origen." };
  }
  if (!candidate.origin.note.trim() || MODEL_THOUGHT.test(candidate.origin.note)) {
    return { ok: false, reason: "El origen no es trazable. «El modelo pensó esto» no basta." };
  }
  const hasTrace =
    candidate.origin.findingIds.length > 0 ||
    candidate.origin.evidenceIds.length > 0 ||
    candidate.origin.contradictionIds.length > 0 ||
    candidate.origin.sealIds.length > 0;
  if (!hasTrace) {
    return { ok: false, reason: "El aprendizaje exige procedencia en el Kernel." };
  }
  const memoryIds = new Set(input.memory.map((item) => item.id));
  if (candidate.evidenceIds.some((id) => memoryIds.has(id))) {
    return { ok: false, reason: "La memoria no es evidencia." };
  }
  if (candidate.relatedMemoryIds.some((id) => candidate.evidenceIds.includes(id))) {
    return { ok: false, reason: "La memoria no es evidencia." };
  }
  const knownEvidence = new Set(input.evidence.map((item) => item.id));
  const cited = candidate.evidenceIds.filter((id) => !knownEvidence.has(id));
  if (cited.length) {
    return { ok: false, reason: "El candidato cita evidencia que el Kernel no admite." };
  }
  if (
    candidate.relation !== "duplicate" &&
    candidate.relation !== "reinforcement" &&
    candidate.evidenceIds.length === 0
  ) {
    return { ok: false, reason: "Un aprendizaje sobre el mundo exige evidencia observada." };
  }
  if (candidate.relation === "reinforcement") {
    const target = input.memory.find((item) => candidate.relatedMemoryIds.includes(item.id));
    if (!target || !isAdmittedMemory(target)) {
      return {
        ok: false,
        reason: "La memoria revocada no vuelve a entrar automáticamente.",
      };
    }
  }
  if (candidate.findingIds.length) {
    const missing = candidate.findingIds.filter((id) => !input.findings.some((item) => item.id === id));
    if (missing.length) {
      return { ok: false, reason: "El candidato cita un hallazgo que el Kernel no admite." };
    }
  }
  return { ok: true, value: true };
}

function statusFor(relation: LearningRelation, valid: boolean): LearningStatus {
  if (!valid) return "blocked";
  if (relation === "duplicate") return "duplicate";
  if (relation === "reinforcement") return "reinforcement";
  if (relation === "contradiction") return "contradicted";
  return "ready";
}

function contradictionDraftFor(
  finding: Finding,
  related: MemoryRecord,
  evidence: Evidence[],
): ContradictionDraft | undefined {
  const source = evidence.find((item) => finding.evidenceIds.includes(item.id) && item.validation === "retrieved");
  if (!source) return undefined;
  return {
    kind: "evidence-memory",
    goalId: finding.goalId,
    left: { kind: "evidence", id: source.id, label: source.title, fingerprint: source.contentHash },
    right: { kind: "memory", id: related.id, label: related.title },
    note: finding.deltaNote?.trim() || `La evidencia de este caso tensiona la memoria admitida: ${related.title}`,
    findingId: finding.id,
    open: isAdmittedMemory(related),
  };
}

export function observeFinding(input: {
  finding: Finding;
  evidence: Evidence[];
  memory: MemoryRecord[];
  findings: Finding[];
  contradictions?: Contradiction[];
}): LearningDraft {
  const classified = classifyFinding(input.finding, input.memory);
  const relatedHits = relatedMemory(
    `${input.finding.title} ${input.finding.answer}`,
    input.memory,
    input.findings,
    input.finding.goalId,
  );
  const pattern = relatedHits[0] && relatedHits[0].memory.goalId !== input.finding.goalId;
  const related = classified.related ?? (pattern ? relatedHits[0].memory : undefined);
  const originKind = pattern && classified.relation !== "contradiction" ? "pattern" : "finding";
  const notes: Record<LearningRelation, string> = {
    novel: pattern
      ? "El mismo terreno aparece en más de un caso."
      : "Hallazgo nuevo con evidencia observada.",
    duplicate: "Este conocimiento ya está admitido en memoria.",
    reinforcement: "Nueva evidencia apoya memoria admitida.",
    refinement: "Nueva evidencia permite precisar una memoria admitida.",
    contradiction: "Nueva evidencia entra en tensión con memoria existente.",
  };
  const evidenceIds = input.finding.evidenceIds.slice();
  const origin = originOf({
    kind: originKind,
    note: notes[classified.relation],
    finding: input.finding,
    evidenceIds,
    memoryIds: related ? [related.id] : [],
  });
  const draft: LearningDraft = {
    key: learningKey({
      originKind,
      relation: classified.relation,
      findingId: input.finding.id,
      memoryId: related?.id,
      evidenceId: evidenceIds[0],
    }),
    relation: classified.relation,
    title: input.finding.title,
    proposal: input.finding.answer,
    origin,
    evidenceIds,
    findingIds: [input.finding.id],
    caseIds: [input.finding.goalId],
    relatedMemoryIds: related ? [related.id] : [],
    contradictionIds: [],
    relatedMemoryId: related?.id,
  };
  const gate = validateLearning(draft, input);
  if (!gate.ok) draft.blockedReason = gate.reason;
  if (classified.relation === "contradiction" && related) {
    const existing = (input.contradictions ?? []).find(
      (item) =>
        item.findingId === input.finding.id &&
        ((item.right.kind === "memory" && item.right.id === related.id) ||
          (item.left.kind === "memory" && item.left.id === related.id)),
    );
    if (existing) draft.contradictionIds = [existing.id];
    else draft.contradictionDraft = contradictionDraftFor(input.finding, related, input.evidence);
  }
  return draft;
}

export function observeEvidenceChange(input: {
  contradiction: Contradiction;
  evidence: Evidence[];
  memory: MemoryRecord[];
  findings: Finding[];
}): LearningDraft | null {
  if (input.contradiction.kind !== "evidence-evidence") return null;
  const evidenceIds = [input.contradiction.left.id, input.contradiction.right.id];
  const draft: LearningDraft = {
    key: learningKey({
      originKind: "evidence-change",
      relation: "contradiction",
      contradictionId: input.contradiction.id,
      evidenceId: evidenceIds[0],
    }),
    relation: "contradiction",
    title: input.contradiction.left.label,
    proposal: input.contradiction.note,
    origin: {
      kind: "evidence-change",
      note: "La misma fuente cambió de huella.",
      goalIds: [input.contradiction.goalId],
      findingIds: input.contradiction.findingId ? [input.contradiction.findingId] : [],
      evidenceIds,
      contradictionIds: [input.contradiction.id],
      sealIds: input.contradiction.sealId ? [input.contradiction.sealId] : [],
      memoryIds: [],
    },
    evidenceIds,
    findingIds: input.contradiction.findingId ? [input.contradiction.findingId] : [],
    caseIds: [input.contradiction.goalId],
    relatedMemoryIds: [],
    contradictionIds: [input.contradiction.id],
  };
  const gate = validateLearning(draft, input);
  if (!gate.ok) draft.blockedReason = gate.reason;
  return draft;
}

export function deriveLearning(input: {
  findings: Finding[];
  evidence: Evidence[];
  memory: MemoryRecord[];
  contradictions: Contradiction[];
}): LearningDraft[] {
  const fromFindings = input.findings.map((finding) =>
    observeFinding({
      finding,
      evidence: input.evidence,
      memory: input.memory,
      findings: input.findings,
      contradictions: input.contradictions,
    }),
  );
  const fromEvidence = input.contradictions
    .map((item) => observeEvidenceChange({ ...input, contradiction: item }))
    .filter((item): item is LearningDraft => Boolean(item));
  const seen = new Set<string>();
  const out: LearningDraft[] = [];
  for (const draft of [...fromFindings, ...fromEvidence]) {
    if (seen.has(draft.key)) continue;
    seen.add(draft.key);
    out.push(draft);
  }
  return out;
}

export function mergeLearning(
  existing: LearningCandidate[],
  derived: LearningDraft[],
  opts: { now: string; nextId: () => string },
): { candidates: LearningCandidate[]; decisions: LearningDecision[]; contradictionDrafts: ContradictionDraft[] } {
  const byKey = new Map(existing.map((item) => [learningKeyFrom(item), item]));
  const out: LearningCandidate[] = [];
  const decisions: LearningDecision[] = [];
  const contradictionDrafts: ContradictionDraft[] = [];
  const seen = new Set<string>();
  for (const draft of derived) {
    if (seen.has(draft.key)) continue;
    seen.add(draft.key);
    const previous = byKey.get(draft.key);
    const valid = !draft.blockedReason;
    const nextStatus = previous && CLOSED.includes(previous.status)
      ? previous.status
      : statusFor(draft.relation, valid);
    const record: LearningCandidate = {
      id: previous?.id ?? opts.nextId(),
      createdAt: previous?.createdAt ?? opts.now,
      status: nextStatus,
      relation: previous && CLOSED.includes(previous.status) ? previous.relation : draft.relation,
      title: draft.title,
      proposal: draft.proposal,
      origin: draft.origin,
      evidenceIds: draft.evidenceIds,
      findingIds: draft.findingIds,
      caseIds: draft.caseIds,
      relatedMemoryIds: draft.relatedMemoryIds,
      contradictionIds: draft.contradictionIds,
      relatedCandidateId: draft.relatedCandidateId ?? previous?.relatedCandidateId,
      relatedMemoryId: draft.relatedMemoryId ?? previous?.relatedMemoryId,
      memoryId: previous?.memoryId,
      blockedReason: nextStatus === "blocked" ? draft.blockedReason : previous?.blockedReason,
      closedAt: previous?.closedAt,
    };
    if (!previous) {
      decisions.push(
        learningDecision(record, {
          at: opts.now,
          from: null,
          to: record.status,
          why: record.origin.note,
          actor: "kernel",
          policy: "kernel-observe",
          decisionId: shortId("ld"),
        }),
      );
    } else if (previous.status !== record.status && !CLOSED.includes(previous.status)) {
      decisions.push(
        learningDecision(record, {
          at: opts.now,
          from: previous.status,
          to: record.status,
          why: record.blockedReason || record.origin.note,
          actor: "kernel",
          policy: "kernel-classify",
          decisionId: shortId("ld"),
        }),
      );
    }
    if (draft.contradictionDraft && record.status === "contradicted") {
      contradictionDrafts.push(draft.contradictionDraft);
    }
    out.push(record);
  }
  for (const previous of existing) {
    const key = learningKeyFrom(previous);
    if (seen.has(key)) continue;
    out.push(previous);
  }
  return {
    candidates: out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)),
    decisions,
    contradictionDrafts,
  };
}

export function learningKeyFrom(item: LearningCandidate) {
  return learningKey({
    originKind: item.origin.kind,
    relation: item.relation,
    findingId: item.findingIds[0],
    memoryId: item.relatedMemoryId ?? item.relatedMemoryIds[0],
    evidenceId: item.evidenceIds[0],
    contradictionId: item.origin.contradictionIds[0] ?? item.contradictionIds[0],
  });
}

export function learningDecision(
  candidate: LearningCandidate,
  input: {
    at: string;
    from: LearningStatus | null;
    to: LearningStatus;
    why: string;
    actor: LearningActor;
    policy: LearningPolicy;
    decisionId: string;
    memoryId?: string;
  },
): LearningDecision {
  return {
    id: input.decisionId,
    candidateId: candidate.id,
    at: input.at,
    from: input.from,
    to: input.to,
    why: input.why.trim(),
    actor: input.actor,
    policy: input.policy,
    memoryId: input.memoryId ?? candidate.memoryId,
    findingId: candidate.findingIds[0],
    evidenceIds: candidate.evidenceIds,
  };
}

/** Learning never writes an admitted MemoryRecord. It only offers a proposed one. */
export function offerToAuthority(input: {
  candidate: LearningCandidate;
  finding: Finding | undefined;
  evidence: Evidence[];
  memory: MemoryRecord[];
  at: string;
  why: string;
  memoryId: string;
}): GateResult<{
  proposed: MemoryRecord;
  propose: MemoryDecision;
  candidate: LearningCandidate;
  decision: LearningDecision;
}> {
  if (input.candidate.relation === "duplicate" || input.candidate.relation === "reinforcement") {
    return {
      ok: false,
      reason:
        input.candidate.relation === "duplicate"
          ? "Este conocimiento ya está admitido. No se crea otra memoria."
          : "El refuerzo no crea una memoria duplicada.",
    };
  }
  if (input.candidate.relation === "contradiction") {
    return {
      ok: false,
      reason: "Un candidato contradictorio no sobrescribe memoria. Se registra la contradicción.",
    };
  }
  if (input.candidate.status === "blocked") {
    return { ok: false, reason: input.candidate.blockedReason || "El candidato no tiene soporte suficiente." };
  }
  if (input.candidate.status === "admitted" || input.candidate.status === "rejected" || input.candidate.status === "proposed") {
    return { ok: false, reason: "Este candidato ya cerró su paso por Memory Authority." };
  }
  const gate = validateLearning(input.candidate, {
    evidence: input.evidence,
    memory: input.memory,
    findings: input.finding ? [input.finding] : [],
  });
  if (!gate.ok) return gate;
  if (!input.finding) {
    return { ok: false, reason: "No hay hallazgo que Memory Authority pueda proponer." };
  }
  const related = input.candidate.relatedMemoryId
    ? input.memory.find((item) => item.id === input.candidate.relatedMemoryId)
    : undefined;
  if (related && !isAdmittedMemory(related) && input.candidate.relation === "refinement") {
    return { ok: false, reason: "La memoria revocada no vuelve a entrar automáticamente." };
  }
  const proposed = buildProposedMemory({
    id: input.memoryId,
    finding: input.finding,
    why: input.why,
    at: input.at,
    supersedesId: input.candidate.relation === "refinement" ? related?.id : undefined,
    candidateId: input.candidate.id,
  });
  const admission = admitMemory({ ...proposed, lifecycle: "admitted", admittedAt: input.at }, input.finding);
  if (!admission.ok) return admission;
  if (proposed.lifecycle !== "proposed") {
    return { ok: false, reason: "Learning no puede admitir memoria. Solo Memory Authority." };
  }
  const next: LearningCandidate = {
    ...input.candidate,
    status: "proposed",
    memoryId: proposed.id,
  };
  return {
    ok: true,
    value: {
      proposed,
      propose: proposeDecision(proposed, {
        at: input.at,
        decisionId: shortId("md"),
        why: input.why,
      }),
      candidate: next,
      decision: learningDecision(next, {
        at: input.at,
        from: input.candidate.status,
        to: "proposed",
        why: input.why,
        actor: "kernel",
        policy: "authority-offer",
        decisionId: shortId("ld"),
        memoryId: proposed.id,
      }),
    },
  };
}

export function acceptOfferedMemory(input: {
  proposed: MemoryRecord;
  why: string;
  at: string;
  actor?: "operator" | "kernel";
  relatedMemoryId?: string;
}): GateResult<{ record: MemoryRecord; decision: MemoryDecision }> {
  return transitionMemory(input.proposed, "admitted", {
    at: input.at,
    why: input.why,
    actor: input.actor ?? "operator",
    policy: "operator-admission",
    decisionId: shortId("md"),
    relatedMemoryId: input.relatedMemoryId,
  });
}

/** Negative: learning cannot mint admitted memory by itself. */
export function skipAuthorityAdmit(_candidate: LearningCandidate): GateResult<MemoryRecord> {
  return { ok: false, reason: "Learning no puede admitir memoria. Solo Memory Authority." };
}

export function memoryIdAsEvidence(_memoryId: string): GateResult<Evidence> {
  return { ok: false, reason: "La memoria no es evidencia." };
}

export function mutatePoliciesFromLearning(): GateResult<never> {
  return { ok: false, reason: "Learning no modifica políticas del Kernel." };
}

export function mutateCodeFromLearning(): GateResult<never> {
  return { ok: false, reason: "Learning no modifica código ni configuración." };
}

export function reviveRevokedWithLearning(record: MemoryRecord): GateResult<MemoryRecord> {
  if (record.lifecycle === "revoked" && !canTransition("revoked", "admitted")) {
    return { ok: false, reason: "La memoria revocada no vuelve a entrar automáticamente." };
  }
  return { ok: false, reason: "Learning no puede admitir memoria. Solo Memory Authority." };
}

export function candidateIsMemory(candidate: LearningCandidate) {
  return "lifecycle" in candidate && !("proposal" in candidate);
}

export function tokensOf(text: string) {
  return tokenize(text);
}
