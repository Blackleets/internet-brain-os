import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  admitDossier,
  admitEvidence,
  admitFinding,
  admitMemory,
  duplicateFinding,
  refuseEvidenceIdReuse,
  refuseFindingIdReuse,
} from "./admission.ts";
import { tensedMemory } from "./delta.ts";
import { commitSeal } from "./dossier.ts";
import {
  allocateMemoryId,
  buildProposedMemory,
  isAdmittedMemory,
  proposeDecision,
  transitionMemory,
} from "./authority.ts";
import { replaySeal as reconstructSeal, type ReplayResult } from "./replay.ts";
import {
  allocateLearningId,
  deriveLearning,
  learningDecision,
  mergeLearning,
  offerToAuthority,
  acceptOfferedMemory,
} from "./learning.ts";
import {
  allocateConfidenceId,
  deriveConfidence,
  mergeConfidence,
} from "./confidence.ts";
import {
  classifyContradictions,
  contradictionKey,
  contradictionLabel,
  mergeContradictions,
} from "./contradiction.ts";
import { duplicateObservation, watchSummary } from "./watch.ts";
import {
  appendActivity,
  assertKernelWritable,
  normalizeActivity,
  recordReplayActivity,
  type ActivityDraft,
} from "./observability.ts";
import { shortId } from "../utils.ts";
import { parseKernelSnapshot } from "./export.ts";
import type {
  ActivityEvent,
  ChatMessage,
  DiscoverySnapshot,
  Dossier,
  Evidence,
  Finding,
  Goal,
  KernelState,
  KnownMemorySnapshot,
  Lead,
  LearningCandidate,
  MemoryDecision,
  MemoryRecord,
  ResearchStage,
  WatchPass,
} from "./types.ts";

const empty: KernelState = {
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
};

function nowIso() {
  return new Date().toISOString();
}

function refuseUnwritable(state: KernelState): { ok: false; reason: string } | null {
  const gate = assertKernelWritable(state);
  if (gate.ok) return null;
  return gate;
}

function log(state: KernelState, event: ActivityDraft): ActivityEvent[] {
  return appendActivity(state.activity ?? [], event, {
    now: event.at ?? nowIso(),
    nextId: () => shortId("a"),
  }).events;
}

function syncContradictions(state: KernelState): Pick<KernelState, "contradictions" | "activity"> {
  const derived = classifyContradictions({
    evidence: state.evidence,
    findings: state.findings,
    memory: state.memory,
    dossiers: state.dossiers,
  });
  const previous = state.contradictions ?? [];
  const next = mergeContradictions(previous, derived, {
    now: nowIso(),
    nextId: () => shortId("x"),
  });
  const previousByKey = new Map(previous.map((item) => [contradictionKey(item), item]));
  let activity = state.activity;
  for (const item of next) {
    const prior = previousByKey.get(contradictionKey(item));
    if (!prior) {
      activity = log(
        { ...state, activity },
        {
          kind: "contradiction.recorded",
          summary: `${contradictionLabel(item.kind)}: ${item.note}`,
          goalId: item.goalId,
          findingId: item.findingId,
          contradictionId: item.id,
          dossierId: item.sealId,
          provenance: {
            evidenceIds: [item.left, item.right].filter((pole) => pole.kind === "evidence").map((pole) => pole.id),
            memoryIds: [item.left, item.right].filter((pole) => pole.kind === "memory").map((pole) => pole.id),
            sealIds: item.sealId ? [item.sealId] : undefined,
          },
        },
      );
    } else if (prior.open && !item.open) {
      activity = log(
        { ...state, activity },
        {
          kind: "contradiction.resolved",
          summary: `Contradicción cerrada: ${contradictionLabel(item.kind)}`,
          goalId: item.goalId,
          findingId: item.findingId,
          contradictionId: item.id,
          dossierId: item.sealId,
        },
      );
    }
  }
  return { contradictions: next, activity };
}

function learningActivityKind(
  status: LearningCandidate["status"],
): ActivityEvent["kind"] {
  if (status === "blocked") return "learning.blocked";
  if (status === "duplicate") return "learning.duplicate";
  if (status === "reinforcement") return "learning.reinforced";
  if (status === "proposed") return "learning.proposed";
  if (status === "rejected") return "learning.rejected";
  if (status === "ready") return "learning.validated";
  return "learning.observed";
}

function syncLearning(
  state: KernelState,
): Pick<KernelState, "learning" | "learningDecisions" | "contradictions" | "activity"> {
  const derived = deriveLearning({
    findings: state.findings,
    evidence: state.evidence,
    memory: state.memory,
    contradictions: state.contradictions ?? [],
  });
  const merged = mergeLearning(state.learning ?? [], derived, {
    now: nowIso(),
    nextId: () => allocateLearningId(state.learning ?? []),
  });
  let contradictions = state.contradictions ?? [];
  let activity = state.activity;
  if (merged.contradictionDrafts.length) {
    const previous = contradictions;
    contradictions = mergeContradictions(previous, merged.contradictionDrafts, {
      now: nowIso(),
      nextId: () => shortId("x"),
    });
    const previousByKey = new Map(previous.map((item) => [contradictionKey(item), item]));
    for (const item of contradictions) {
      const prior = previousByKey.get(contradictionKey(item));
      if (!prior) {
        activity = log(
          { ...state, activity },
          {
            kind: "contradiction.recorded",
            summary: `${contradictionLabel(item.kind)}: ${item.note}`,
            goalId: item.goalId,
            findingId: item.findingId,
            contradictionId: item.id,
            dossierId: item.sealId,
          },
        );
      } else if (prior.open && !item.open) {
        activity = log(
          { ...state, activity },
          {
            kind: "contradiction.resolved",
            summary: `Contradicción cerrada: ${contradictionLabel(item.kind)}`,
            goalId: item.goalId,
            findingId: item.findingId,
            contradictionId: item.id,
            dossierId: item.sealId,
          },
        );
      }
    }
  }
  const candidates = merged.candidates.map((item) => {
    if (item.contradictionIds.length || item.relation !== "contradiction") return item;
    const linked = contradictions.filter(
      (row) => row.findingId && item.findingIds.includes(row.findingId),
    );
    return linked.length ? { ...item, contradictionIds: linked.map((row) => row.id) } : item;
  });
  for (const decision of merged.decisions) {
    const candidate = candidates.find((item) => item.id === decision.candidateId);
    activity = log(
      { ...state, activity },
      {
        kind: learningActivityKind(decision.to),
        summary: candidate
          ? `Aprendizaje ${decision.to}: ${candidate.title}`
          : `Aprendizaje ${decision.to}`,
        goalId: candidate?.caseIds[0],
        findingId: decision.findingId,
        learningCandidateId: decision.candidateId,
        memoryId: decision.memoryId,
        provenance: {
          evidenceIds: candidate?.evidenceIds,
          findingIds: candidate?.findingIds,
        },
      },
    );
  }
  return {
    learning: candidates,
    learningDecisions: [...merged.decisions, ...(state.learningDecisions ?? [])],
    contradictions,
    activity,
  };
}

function syncConfidence(
  state: KernelState,
): Pick<KernelState, "confidence" | "activity"> {
  const derived = deriveConfidence({
    findings: state.findings,
    evidence: state.evidence,
    memory: state.memory,
    contradictions: state.contradictions ?? [],
    learning: state.learning,
  });
  const merged = mergeConfidence(state.confidence ?? [], derived, {
    now: nowIso(),
    nextId: () => allocateConfidenceId(state.confidence ?? []),
  });
  let activity = state.activity;
  for (const record of merged.created) {
    const goalId = state.findings.find((item) => item.id === record.findingId)?.goalId;
    activity = log(
      { ...state, activity },
      {
        kind: record.version > 1 ? "confidence.changed" : "confidence.evaluated",
        summary: record.changeNote
          ? `Soporte ${record.band} (${record.score}): ${record.changeNote}`
          : `Soporte ${record.band} (${record.score})`,
        goalId,
        findingId: record.findingId,
        confidenceId: record.id,
        policy: `${record.algorithm}:${record.policyId}`,
        provenance: {
          evidenceIds: record.evidenceIds,
          memoryIds: record.memoryIds,
        },
        causal: {
          previous: record.previousId,
          next: String(record.score),
        },
      },
    );
  }
  return { confidence: merged.records, activity };
}

function syncKernel(state: KernelState) {
  const contradictions = syncContradictions(state);
  const withContradictions = { ...state, ...contradictions };
  const learning = syncLearning(withContradictions);
  const withLearning = { ...withContradictions, ...learning };
  const confidence = syncConfidence(withLearning);
  return { ...learning, ...confidence };
}

function withGoalDefaults(goal: Goal): Goal {
  return {
    ...goal,
    leads: goal.leads ?? [],
    watched: goal.watched ?? false,
    leadCount: goal.leadCount ?? goal.leads?.length ?? 0,
    lastWatchAt: goal.lastWatchAt,
    lastWatchSummary: goal.lastWatchSummary,
    spawnedFromGoalId: goal.spawnedFromGoalId,
    spawnedFromDossierId: goal.spawnedFromDossierId,
    discovery: goal.discovery,
  };
}

function withMemoryDefaults(record: MemoryRecord): MemoryRecord {
  return {
    ...record,
    informedGoalIds: record.informedGoalIds ?? [],
    proposedAt: record.proposedAt || record.admittedAt,
    admittedAt: record.admittedAt,
  };
}

function withKnownDefaults(
  item: Partial<KnownMemorySnapshot> & Pick<KnownMemorySnapshot, "memoryId" | "title">,
  sealedAt: string,
): KnownMemorySnapshot {
  return {
    memoryId: item.memoryId,
    title: item.title,
    findingId: item.findingId ?? "",
    goalId: item.goalId ?? "",
    admittedAt: item.admittedAt ?? sealedAt,
    lifecycle: item.lifecycle ?? "admitted",
    whyHash: item.whyHash ?? "",
    consultedAt: item.consultedAt ?? sealedAt,
  };
}

function withDossierDefaults(dossier: Dossier): Dossier {
  return {
    ...dossier,
    memoryContextHash: dossier.memoryContextHash ?? "",
    known: (dossier.known ?? []).map((item) => withKnownDefaults(item, dossier.sealedAt)),
  };
}

interface KernelActions {
  createGoal: (
    text: string,
    source?: { goalId: string; dossierId: string },
  ) => Goal;
  setGoalStage: (
    goalId: string,
    stage: ResearchStage,
    extra?: { blockedReason?: string; leadCount?: number; discovery?: DiscoverySnapshot },
  ) => void;
  setGoalLeads: (goalId: string, leads: Lead[], extra?: { discovery?: DiscoverySnapshot }) => void;
  toggleWatch: (goalId: string) => void;
  tryAdmitEvidence: (candidate: Evidence) => { ok: true } | { ok: false; reason: string };
  tryAdmitFinding: (candidate: Finding) => { ok: true } | { ok: false; reason: string };
  admitFindingToMemory: (
    findingId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  replaceTensedMemory: (
    findingId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  forgetMemory: (memoryId: string) => void;
  markMemoryConsulted: (memoryIds: string[], goalId: string) => void;
  sealDossier: (candidate: Dossier) => { ok: true } | { ok: false; reason: string };
  recordWatchPass: (pass: WatchPass) => void;
  addChat: (
    role: ChatMessage["role"],
    content: string,
    meta?: { provider?: string; model?: string; latencyMs?: number },
  ) => void;
  logActivity: (draft: ActivityDraft) => void;
  clearChat: () => void;
  exportKernel: () => string;
  importKernel: (raw: string) => { ok: true } | { ok: false; reason: string };
  clearKernel: () => void;
  replaySeal: (sealId: string) => ReplayResult;
  acceptLearning: (
    candidateId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  rejectLearning: (
    candidateId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  quarantineLearning: (
    candidateId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  admitQuarantined: (
    memoryId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
  rejectQuarantined: (
    memoryId: string,
    why: string,
  ) => { ok: true } | { ok: false; reason: string };
}

const memoryStorage = createJSONStorage<KernelState>(() => {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return localStorage;
});

export const useKernel = create<KernelState & KernelActions>()(
  persist(
    (set, get) => ({
      ...empty,
      createGoal: (text, source) => {
        const goal: Goal = {
          id: shortId("g"),
          text: text.trim(),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          status: "researching",
          stage: "understood",
          evidenceIds: [],
          findingIds: [],
          leadCount: 0,
          leads: [],
          watched: false,
          spawnedFromGoalId: source?.goalId,
          spawnedFromDossierId: source?.dossierId,
        };
        set((state) => ({
          goals: [goal, ...state.goals],
          activity: log(state, {
            kind: "goal.created",
            actor: "operator",
            summary: source
              ? `Objetivo abierto desde un dosier: ${goal.text}`
              : `Objetivo creado: ${goal.text}`,
            goalId: goal.id,
            correlationId: goal.id,
            dossierId: source?.dossierId,
            causal: source?.dossierId ? { triggeredBy: source.dossierId } : undefined,
          }),
        }));
        return goal;
      },
      setGoalStage: (goalId, stage, extra) => {
        set((state) => {
          const nextGoals = state.goals.map((goal) => {
            if (goal.id !== goalId) return withGoalDefaults(goal);
            const status: Goal["status"] =
              stage === "complete"
                ? "complete"
                : stage === "blocked"
                  ? "blocked"
                  : stage === "failed"
                    ? "failed"
                    : "researching";
            return {
              ...withGoalDefaults(goal),
              stage,
              status,
              updatedAt: nowIso(),
              blockedReason: extra?.blockedReason,
              leadCount: extra?.leadCount ?? goal.leadCount,
              discovery: extra?.discovery ?? goal.discovery,
            };
          });
          let activity = state.activity;
          if (stage === "blocked" || stage === "failed") {
            activity = log(state, {
              kind: stage === "blocked" ? "research.blocked" : "research.failed",
              summary: extra?.blockedReason ?? "Investigación incompleta.",
              goalId,
              correlationId: goalId,
            });
          } else if (stage === "reading") {
            if (state.goals.find((item) => item.id === goalId)?.stage === "searching") {
              activity = log(state, {
                kind: "search.completed",
                summary: extra?.discovery
                  ? `Búsqueda pública: ${extra.discovery.found} encontradas, ${extra.discovery.usable} utilizables, ${extra.discovery.domains.length} dominio(s). No es evidencia.`
                  : `Búsqueda pública: ${extra?.leadCount ?? 0} pista(s). No es evidencia.`,
                goalId,
                correlationId: goalId,
              });
            }
          }
          return { goals: nextGoals, activity };
        });
      },
      setGoalLeads: (goalId, leads, extra) => {
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId
              ? {
                  ...withGoalDefaults(goal),
                  leads,
                  leadCount: leads.length,
                  discovery: extra?.discovery ?? goal.discovery,
                  updatedAt: nowIso(),
                }
              : withGoalDefaults(goal),
          ),
        }));
      },
      toggleWatch: (goalId) => {
        set((state) => ({
          goals: state.goals.map((goal) =>
            goal.id === goalId
              ? { ...withGoalDefaults(goal), watched: !goal.watched, updatedAt: nowIso() }
              : withGoalDefaults(goal),
          ),
        }));
      },
      tryAdmitEvidence: (candidate) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const reused = refuseEvidenceIdReuse(get().evidence, candidate);
        if (!reused.ok) return reused;
        if (duplicateObservation(get().evidence, candidate)) {
          return { ok: false, reason: "Esta observación ya está retenida para el objetivo." };
        }
        const gate = admitEvidence(candidate, get().memory);
        if (!gate.ok) {
          set((state) => ({
            activity: log(state, {
              kind: "evidence.rejected",
              summary: gate.reason,
              goalId: candidate.goalId,
              correlationId: candidate.goalId,
            }),
          }));
          return gate;
        }
        set((state) => {
          const next: KernelState = {
            ...state,
            evidence: [gate.value, ...state.evidence],
            goals: state.goals.map((goal) =>
              goal.id === gate.value.goalId
                ? {
                    ...withGoalDefaults(goal),
                    evidenceIds: goal.evidenceIds.includes(gate.value.id)
                      ? goal.evidenceIds
                      : [...goal.evidenceIds, gate.value.id],
                    updatedAt: nowIso(),
                  }
                : withGoalDefaults(goal),
            ),
            activity: log(state, {
              kind: "evidence.admitted",
              summary: gate.value.reused
                ? `Fuente ya observada, re-admitida para este caso (${gate.value.sourceHost})`
                : `Evidencia retenida de ${gate.value.sourceHost}`,
              goalId: gate.value.goalId,
              evidenceId: gate.value.id,
              correlationId: gate.value.goalId,
              provenance: {
                evidenceIds: [gate.value.id],
                hashes: [gate.value.contentHash],
              },
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      tryAdmitFinding: (candidate) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const reused = refuseFindingIdReuse(get().findings, candidate);
        if (!reused.ok) return reused;
        const cited = get().evidence.filter((item) =>
          candidate.evidenceIds.includes(item.id),
        );
        const goal = get().goals.find((item) => item.id === candidate.goalId);
        const gate = admitFinding(candidate, cited, get().memory, goal?.text);
        if (!gate.ok) return gate;
        if (duplicateFinding(get().findings, candidate)) {
          return { ok: false, reason: "Este hallazgo ya está retenido para el objetivo." };
        }
        set((state) => {
          const next: KernelState = {
            ...state,
            findings: [gate.value, ...state.findings],
            goals: state.goals.map((goal) =>
              goal.id === gate.value.goalId
                ? {
                    ...withGoalDefaults(goal),
                    findingIds: goal.findingIds.includes(gate.value.id)
                      ? goal.findingIds
                      : [...goal.findingIds, gate.value.id],
                    updatedAt: nowIso(),
                  }
                : withGoalDefaults(goal),
            ),
            activity: log(state, {
              kind: "finding.admitted",
              summary: `Hallazgo vinculado a evidencia: ${gate.value.title}`,
              goalId: gate.value.goalId,
              findingId: gate.value.id,
              correlationId: gate.value.goalId,
              provenance: { evidenceIds: gate.value.evidenceIds, findingIds: [gate.value.id] },
              causal: { derivedFrom: gate.value.evidenceIds, triggeredBy: gate.value.id },
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      admitFindingToMemory: (findingId, why) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const finding = get().findings.find((item) => item.id === findingId);
        const at = nowIso();
        const linked = (get().learning ?? []).find(
          (item) => item.findingIds.includes(findingId) && !item.memoryId,
        );
        const proposed = finding
          ? buildProposedMemory({
              id: allocateMemoryId(get().memory, get().evidence),
              finding,
              why,
              at,
              candidateId: linked?.id,
            })
          : undefined;
        const candidate = proposed
          ? { ...proposed, lifecycle: "admitted" as const, admittedAt: at }
          : {
              id: "",
              findingId,
              goalId: "",
              title: "",
              why: why.trim(),
              evidenceIds: [] as string[],
              proposedAt: at,
              admittedAt: at,
              lifecycle: "admitted" as const,
              informedGoalIds: [] as string[],
            };
        const gate = admitMemory(candidate, finding);
        if (!gate.ok) {
          if (proposed && finding && why.trim().length >= 8) {
            const rejected = transitionMemory(proposed, "rejected", {
              at,
              why: gate.reason,
              actor: "kernel",
              policy: "admission-gate",
              decisionId: shortId("md"),
            });
            if (rejected.ok) {
              set((state) => ({
                ...state,
                memory: [rejected.value.record, ...state.memory],
                memoryDecisions: [
                  proposeDecision(proposed, { at, decisionId: shortId("md") }),
                  rejected.value.decision,
                  ...state.memoryDecisions,
                ],
                activity: log(state, {
                  kind: "memory.rejected",
                  summary: `Memoria rechazada: ${proposed.title}`,
                  goalId: proposed.goalId,
                  findingId,
                  memoryId: proposed.id,
                  correlationId: proposed.goalId,
                  policy: "admission-gate",
                }),
              }));
            }
          }
          return gate;
        }
        const admitted = proposed
          ? transitionMemory(proposed, "admitted", {
              at,
              why: why.trim(),
              actor: "operator",
              policy: "operator-admission",
              decisionId: shortId("md"),
            })
          : undefined;
        const record = admitted?.ok ? admitted.value.record : gate.value;
        const decisions: MemoryDecision[] = [];
        if (proposed) decisions.push(proposeDecision(proposed, { at, decisionId: shortId("md") }));
        if (admitted?.ok) decisions.push(admitted.value.decision);
        set((state) => {
          let activity = log(state, {
            kind: "memory.proposed",
            summary: `Memoria propuesta: ${record.title}`,
            goalId: record.goalId,
            findingId,
            memoryId: record.id,
            learningCandidateId: linked?.id,
            correlationId: record.goalId,
            policy: "kernel-propose",
            provenance: { evidenceIds: record.evidenceIds, findingIds: [findingId] },
          });
          activity = log(
            { ...state, activity },
            {
              kind: "memory.admitted",
              actor: "operator",
              summary: `Memoria admitida: ${record.title}`,
              goalId: record.goalId,
              findingId,
              memoryId: record.id,
              learningCandidateId: linked?.id,
              correlationId: record.goalId,
              policy: "operator-admission",
              provenance: { evidenceIds: record.evidenceIds, findingIds: [findingId] },
              causal: { derivedFrom: record.evidenceIds, triggeredBy: findingId },
            },
          );
          const next: KernelState = {
            ...state,
            memory: [record, ...state.memory],
            memoryDecisions: [...decisions, ...state.memoryDecisions],
            learning: (state.learning ?? []).map((item) =>
              linked && item.id === linked.id
                ? { ...item, status: "admitted", memoryId: record.id, closedAt: at }
                : item,
            ),
            learningDecisions: linked
              ? [
                  learningDecision(
                    { ...linked, status: "admitted", memoryId: record.id },
                    {
                      at,
                      from: linked.status,
                      to: "admitted",
                      why: why.trim(),
                      actor: "operator",
                      policy: "operator-admission",
                      decisionId: shortId("ld"),
                      memoryId: record.id,
                    },
                  ),
                  ...(state.learningDecisions ?? []),
                ]
              : state.learningDecisions,
            activity,
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      replaceTensedMemory: (findingId, why) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const finding = get().findings.find((item) => item.id === findingId);
        if (!finding) {
          return { ok: false, reason: "No hay hallazgo que sustituya memoria." };
        }
        const prior = tensedMemory(finding, get().memory);
        if (!prior) {
          return {
            ok: false,
            reason: "Este hallazgo no tensiona una memoria admitida de otro caso.",
          };
        }
        const at = nowIso();
        const existing = get().memory.find(
          (item) => item.findingId === findingId && isAdmittedMemory(item),
        );
        let incoming = existing;
        const decisions: MemoryDecision[] = [];
        if (!incoming) {
          const proposed = buildProposedMemory({
            id: allocateMemoryId(get().memory, get().evidence),
            finding,
            why,
            at,
            supersedesId: prior.id,
          });
          const gate = admitMemory(
            { ...proposed, lifecycle: "admitted", admittedAt: at, supersedesId: prior.id },
            finding,
          );
          if (!gate.ok) return gate;
          const admitted = transitionMemory(proposed, "admitted", {
            at,
            why: why.trim(),
            actor: "operator",
            policy: "operator-admission",
            decisionId: shortId("md"),
            relatedMemoryId: prior.id,
          });
          if (!admitted.ok) return admitted;
          incoming = { ...admitted.value.record, supersedesId: prior.id };
          decisions.push(proposeDecision(proposed, { at, decisionId: shortId("md") }));
          decisions.push(admitted.value.decision);
        }
        const closed = transitionMemory(prior, "superseded", {
          at,
          why: `Sustituida por «${incoming.title}».`,
          actor: "operator",
          policy: "supersede-tensed",
          decisionId: shortId("md"),
          relatedMemoryId: incoming.id,
        });
        if (!closed.ok) return closed;
        decisions.push(closed.value.decision);
        const successor = incoming;
        set((state) => {
          const without = state.memory.filter(
            (item) => item.id !== prior.id && item.id !== successor.id,
          );
          let activity = state.activity;
          if (!existing) {
            activity = log(
              { ...state, activity },
              {
                kind: "memory.proposed",
                summary: `Memoria propuesta, sustituye «${prior.title}»: ${successor.title}`,
                goalId: successor.goalId,
                findingId,
                memoryId: successor.id,
                correlationId: successor.goalId,
                policy: "kernel-propose",
              },
            );
            activity = log(
              { ...state, activity },
              {
                kind: "memory.admitted",
                actor: "operator",
                summary: `Memoria admitida, sustituye «${prior.title}»: ${successor.title}`,
                goalId: successor.goalId,
                findingId,
                memoryId: successor.id,
                correlationId: successor.goalId,
                policy: "operator-admission",
                causal: { supersedes: prior.id, triggeredBy: findingId, derivedFrom: successor.evidenceIds },
              },
            );
          }
          activity = log(
            { ...state, activity },
            {
              kind: "memory.superseded",
              actor: "operator",
              summary: `Memoria sustituida: ${prior.title} → ${successor.title}`,
              goalId: prior.goalId,
              findingId: prior.findingId,
              memoryId: prior.id,
              correlationId: prior.goalId,
              policy: "supersede-tensed",
              causal: { supersedes: prior.id, triggeredBy: successor.id },
            },
          );
          const next: KernelState = {
            ...state,
            memory: [successor, closed.value.record, ...without],
            memoryDecisions: [...decisions, ...state.memoryDecisions],
            activity,
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      forgetMemory: (memoryId) => {
        const record = get().memory.find((item) => item.id === memoryId);
        if (!record) return;
        const closed = transitionMemory(record, "revoked", {
          at: nowIso(),
          why: "Olvidada por el operador.",
          actor: "operator",
          policy: "operator-revoke",
          decisionId: shortId("md"),
        });
        if (!closed.ok) return;
        set((state) => {
          const next: KernelState = {
            ...state,
            memory: state.memory.map((item) =>
              item.id === memoryId ? closed.value.record : item,
            ),
            memoryDecisions: [closed.value.decision, ...state.memoryDecisions],
            activity: log(state, {
              kind: "memory.revoked",
              actor: "operator",
              summary: `Memoria revocada: ${record.title}`,
              goalId: record.goalId,
              findingId: record.findingId,
              memoryId: record.id,
              correlationId: record.goalId,
              policy: "operator-revoke",
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
      },
      markMemoryConsulted: (memoryIds, goalId) => {
        if (!memoryIds.length) return;
        set((state) => ({
          memory: state.memory.map((record) => {
            const current = withMemoryDefaults(record);
            if (!memoryIds.includes(current.id)) return current;
            if (current.informedGoalIds.includes(goalId)) return current;
            return {
              ...current,
              informedGoalIds: [...current.informedGoalIds, goalId],
            };
          }),
          activity: log(state, {
            kind: "memory.consulted",
            summary: `Memoria consultada (${memoryIds.length}): no es evidencia de este caso.`,
            goalId,
            correlationId: goalId,
            provenance: { memoryIds },
          }),
        }));
      },
      sealDossier: (candidate) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const state = get();
        const goal = state.goals.find((item) => item.id === candidate.goalId);
        const gate = admitDossier(
          candidate,
          state.findings,
          state.evidence,
          state.memory,
          goal?.text,
        );
        if (!gate.ok) return gate;
        set((current) => {
          const nextDossiers = commitSeal(current.dossiers, gate.value);
          if (nextDossiers === current.dossiers) return current;
          const sealed = nextDossiers[0];
          const next: KernelState = {
            ...current,
            dossiers: nextDossiers,
            activity: log(current, {
              kind: "dossier.sealed",
              summary: sealed.supersedesId
                ? `Dosier resellado · ${sealed.sealHash.slice(0, 12)}…`
                : `Dosier sellado · ${sealed.sealHash.slice(0, 12)}…`,
              goalId: sealed.goalId,
              dossierId: sealed.id,
              correlationId: sealed.goalId,
              provenance: {
                evidenceIds: sealed.evidenceIds,
                findingIds: sealed.findingIds,
                sealIds: [sealed.id],
                hashes: [sealed.sealHash, ...sealed.evidenceHashes],
                memoryIds: sealed.known.map((item) => item.memoryId),
              },
              causal: sealed.supersedesId
                ? { supersedes: sealed.supersedesId, derivedFrom: sealed.evidenceIds }
                : { derivedFrom: sealed.evidenceIds },
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      recordWatchPass: (pass) => {
        set((state) => {
          const next: KernelState = {
            ...state,
            watchPasses: [pass, ...state.watchPasses],
            goals: state.goals.map((goal) =>
              goal.id === pass.goalId
                ? {
                    ...withGoalDefaults(goal),
                    lastWatchAt: pass.at,
                    lastWatchSummary: watchSummary(pass),
                    updatedAt: pass.at,
                  }
                : withGoalDefaults(goal),
            ),
            activity: log(state, {
              kind: "watch.completed",
              summary: `Relectura: ${watchSummary(pass)}`,
              goalId: pass.goalId,
              correlationId: pass.goalId,
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
      },
      addChat: (role, content, meta) => {
        const message: ChatMessage = {
          id: shortId("c"),
          role,
          content,
          createdAt: nowIso(),
          provider: meta?.provider,
          model: meta?.model,
          latencyMs: meta?.latencyMs,
        };
        set((state) => {
          const activity =
            role === "assistant"
              ? log(state, {
                  kind: "chat.message",
                  actor: "kernel",
                  source: "chat",
                  summary: meta?.provider
                    ? `Conversación · ${meta.provider}/${meta.model ?? "modelo"} · no es evidencia`
                    : "Conversación · no es evidencia",
                  correlationId: message.id,
                  ai: meta?.provider
                    ? {
                        provider: meta.provider,
                        model: meta.model ?? "",
                        operation: "chat",
                        latencyMs: meta.latencyMs,
                      }
                    : undefined,
                })
              : state.activity;
          return { chat: [...state.chat, message], activity };
        });
      },
      logActivity: (draft) => {
        set((state) => ({
          activity: log(state, draft),
        }));
      },
      clearChat: () => set({ chat: [] }),
      acceptLearning: (candidateId, why) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const candidate = (get().learning ?? []).find((item) => item.id === candidateId);
        if (!candidate) {
          return { ok: false, reason: "No hay un candidato de aprendizaje con ese identificador." };
        }
        const at = nowIso();
        if (candidate.relation === "duplicate" || candidate.relation === "reinforcement") {
          const nextStatus = candidate.relation === "duplicate" ? "duplicate" : "reinforcement";
          set((state) => ({
            ...state,
            learning: state.learning.map((item) =>
              item.id === candidateId
                ? { ...item, status: nextStatus, relatedMemoryId: candidate.relatedMemoryId }
                : item,
            ),
            learningDecisions: [
              learningDecision(candidate, {
                at,
                from: candidate.status,
                to: nextStatus,
                why: why.trim() || candidate.origin.note,
                actor: "operator",
                policy: "kernel-classify",
                decisionId: shortId("ld"),
                memoryId: candidate.relatedMemoryId,
              }),
              ...(state.learningDecisions ?? []),
            ],
            activity: log(state, {
              kind: candidate.relation === "duplicate" ? "learning.duplicate" : "learning.reinforced",
              summary:
                candidate.relation === "duplicate"
                  ? `Aprendizaje duplicado: ${candidate.title}`
                  : `Aprendizaje refuerza memoria: ${candidate.title}`,
              goalId: candidate.caseIds[0],
              findingId: candidate.findingIds[0],
              learningCandidateId: candidate.id,
              memoryId: candidate.relatedMemoryId,
              correlationId: candidate.caseIds[0],
            }),
          }));
          return { ok: true };
        }
        if (candidate.relation === "contradiction") {
          return {
            ok: false,
            reason: "Un candidato contradictorio no sobrescribe memoria. Se registra la contradicción.",
          };
        }
        if (candidate.status === "proposed" && candidate.memoryId) {
          const existing = get().memory.find((item) => item.id === candidate.memoryId);
          if (!existing || (existing.lifecycle !== "proposed" && existing.lifecycle !== "quarantined")) {
            return { ok: false, reason: "Este candidato ya cerró su paso por Memory Authority." };
          }
          const admittedExisting = acceptOfferedMemory({
            proposed: existing,
            why,
            at,
            relatedMemoryId: existing.supersedesId,
          });
          if (!admittedExisting.ok) return admittedExisting;
          set((state) => {
            const next: KernelState = {
              ...state,
              memory: state.memory.map((item) =>
                item.id === existing.id ? admittedExisting.value.record : item,
              ),
              memoryDecisions: [admittedExisting.value.decision, ...state.memoryDecisions],
              learning: state.learning.map((item) =>
                item.id === candidateId
                  ? {
                      ...item,
                      status: "admitted",
                      memoryId: admittedExisting.value.record.id,
                      closedAt: at,
                    }
                  : item,
              ),
              learningDecisions: [
                learningDecision(
                  { ...candidate, status: "admitted", memoryId: admittedExisting.value.record.id },
                  {
                    at,
                    from: "proposed",
                    to: "admitted",
                    why: why.trim(),
                    actor: "operator",
                    policy: "operator-admission",
                    decisionId: shortId("ld"),
                    memoryId: admittedExisting.value.record.id,
                  },
                ),
                ...(state.learningDecisions ?? []),
              ],
              activity: log(state, {
                kind: "memory.admitted",
                actor: "operator",
                summary: `Memoria admitida desde aprendizaje: ${admittedExisting.value.record.title}`,
                goalId: admittedExisting.value.record.goalId,
                findingId: admittedExisting.value.record.findingId,
                memoryId: admittedExisting.value.record.id,
                learningCandidateId: candidateId,
                correlationId: admittedExisting.value.record.goalId,
                policy: "operator-admission",
                causal: { triggeredBy: candidateId, derivedFrom: admittedExisting.value.record.evidenceIds },
              }),
            };
            const synced = syncKernel(next);
            return { ...next, ...synced };
          });
          return { ok: true };
        }
        const finding = get().findings.find((item) => candidate.findingIds.includes(item.id));
        const offered = offerToAuthority({
          candidate,
          finding,
          evidence: get().evidence,
          memory: get().memory,
          at,
          why,
          memoryId: allocateMemoryId(get().memory, get().evidence),
        });
        if (!offered.ok) return offered;
        const admitted = acceptOfferedMemory({
          proposed: offered.value.proposed,
          why,
          at,
          relatedMemoryId: offered.value.proposed.supersedesId,
        });
        if (!admitted.ok) return admitted;
        const prior = offered.value.proposed.supersedesId
          ? get().memory.find((item) => item.id === offered.value.proposed.supersedesId)
          : undefined;
        const closed = prior
          ? transitionMemory(prior, "superseded", {
              at,
              why: `Sustituida por «${admitted.value.record.title}».`,
              actor: "operator",
              policy: "supersede-tensed",
              decisionId: shortId("md"),
              relatedMemoryId: admitted.value.record.id,
            })
          : undefined;
        set((state) => {
          const without = state.memory.filter(
            (item) => item.id !== admitted.value.record.id && item.id !== prior?.id,
          );
          const memory = [
            admitted.value.record,
            ...(closed?.ok ? [closed.value.record] : []),
            ...without,
          ];
          const decisions = [
            offered.value.propose,
            admitted.value.decision,
            ...(closed?.ok ? [closed.value.decision] : []),
            ...state.memoryDecisions,
          ];
          const next: KernelState = {
            ...state,
            memory,
            memoryDecisions: decisions,
            learning: state.learning.map((item) =>
              item.id === candidateId
                ? {
                    ...item,
                    status: "admitted",
                    memoryId: admitted.value.record.id,
                    closedAt: at,
                  }
                : item,
            ),
            learningDecisions: [
              offered.value.decision,
              learningDecision(
                { ...candidate, status: "admitted", memoryId: admitted.value.record.id },
                {
                  at,
                  from: "proposed",
                  to: "admitted",
                  why: why.trim(),
                  actor: "operator",
                  policy: "operator-admission",
                  decisionId: shortId("ld"),
                  memoryId: admitted.value.record.id,
                },
              ),
              ...(state.learningDecisions ?? []),
            ],
            activity: log(state, {
              kind: "memory.admitted",
              actor: "operator",
              summary: `Memoria admitida desde aprendizaje: ${admitted.value.record.title}`,
              goalId: admitted.value.record.goalId,
              findingId: admitted.value.record.findingId,
              memoryId: admitted.value.record.id,
              learningCandidateId: candidateId,
              correlationId: admitted.value.record.goalId,
              policy: "operator-admission",
              causal: {
                triggeredBy: candidateId,
                derivedFrom: admitted.value.record.evidenceIds,
                supersedes: prior?.id,
              },
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      rejectLearning: (candidateId, why) => {
        const candidate = (get().learning ?? []).find((item) => item.id === candidateId);
        if (!candidate) {
          return { ok: false, reason: "No hay un candidato de aprendizaje con ese identificador." };
        }
        const at = nowIso();
        const proposed = candidate.memoryId
          ? get().memory.find(
              (item) =>
                item.id === candidate.memoryId &&
                (item.lifecycle === "proposed" || item.lifecycle === "quarantined"),
            )
          : undefined;
        const rejected = proposed
          ? transitionMemory(proposed, "rejected", {
              at,
              why: why.trim() || "Rechazado por el operador.",
              actor: "operator",
              policy: "operator-admission",
              decisionId: shortId("md"),
            })
          : undefined;
        set((state) => {
          const next: KernelState = {
            ...state,
            memory: rejected?.ok
              ? state.memory.map((item) =>
                  item.id === proposed?.id ? rejected.value.record : item,
                )
              : state.memory,
            memoryDecisions: rejected?.ok
              ? [rejected.value.decision, ...state.memoryDecisions]
              : state.memoryDecisions,
            learning: state.learning.map((item) =>
              item.id === candidateId
                ? { ...item, status: "rejected", closedAt: at }
                : item,
            ),
            learningDecisions: [
              learningDecision(candidate, {
                at,
                from: candidate.status,
                to: "rejected",
                why: why.trim() || "Rechazado por el operador.",
                actor: "operator",
                policy: "operator-reject",
                decisionId: shortId("ld"),
                memoryId: candidate.memoryId,
              }),
              ...(state.learningDecisions ?? []),
            ],
            activity: log(state, {
              kind: "learning.rejected",
              actor: "operator",
              summary: `Aprendizaje rechazado: ${candidate.title}`,
              goalId: candidate.caseIds[0],
              findingId: candidate.findingIds[0],
              learningCandidateId: candidateId,
              memoryId: candidate.memoryId,
              correlationId: candidate.caseIds[0],
              policy: "operator-reject",
            }),
          };
          return next;
        });
        return { ok: true };
      },
      quarantineLearning: (candidateId, why) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const candidate = (get().learning ?? []).find((item) => item.id === candidateId);
        if (!candidate) {
          return { ok: false, reason: "No hay un candidato de aprendizaje con ese identificador." };
        }
        if (why.trim().length < 8) {
          return { ok: false, reason: "La cuarentena exige una razón del operador (mínimo 8 caracteres)." };
        }
        const at = nowIso();
        const finding = get().findings.find((item) => candidate.findingIds.includes(item.id));
        const offered = offerToAuthority({
          candidate,
          finding,
          evidence: get().evidence,
          memory: get().memory,
          at,
          why,
          memoryId: allocateMemoryId(get().memory, get().evidence),
        });
        if (!offered.ok) return offered;
        const quarantined = transitionMemory(offered.value.proposed, "quarantined", {
          at,
          why: why.trim(),
          actor: "operator",
          policy: "operator-quarantine",
          decisionId: shortId("md"),
        });
        if (!quarantined.ok) return quarantined;
        set((state) => {
          const next: KernelState = {
            ...state,
            memory: [quarantined.value.record, ...state.memory],
            memoryDecisions: [
              offered.value.propose,
              quarantined.value.decision,
              ...state.memoryDecisions,
            ],
            learning: state.learning.map((item) =>
              item.id === candidateId
                ? { ...item, status: "proposed", memoryId: quarantined.value.record.id }
                : item,
            ),
            learningDecisions: [
              offered.value.decision,
              ...(state.learningDecisions ?? []),
            ],
            activity: log(state, {
              kind: "memory.quarantined",
              actor: "operator",
              summary: `Memoria en cuarentena: ${quarantined.value.record.title}`,
              goalId: quarantined.value.record.goalId,
              findingId: quarantined.value.record.findingId,
              memoryId: quarantined.value.record.id,
              learningCandidateId: candidateId,
              correlationId: quarantined.value.record.goalId,
              policy: "operator-quarantine",
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      admitQuarantined: (memoryId, why) => {
        const blocked = refuseUnwritable(get());
        if (blocked) return blocked;
        const record = get().memory.find((item) => item.id === memoryId);
        if (!record || record.lifecycle !== "quarantined") {
          return { ok: false, reason: "No hay una memoria en cuarentena con ese identificador." };
        }
        if (why.trim().length < 8) {
          return { ok: false, reason: "La memoria exige una razón del operador (mínimo 8 caracteres)." };
        }
        const at = nowIso();
        const admitted = transitionMemory(record, "admitted", {
          at,
          why: why.trim(),
          actor: "operator",
          policy: "operator-admission",
          decisionId: shortId("md"),
        });
        if (!admitted.ok) return admitted;
        set((state) => {
          const next: KernelState = {
            ...state,
            memory: state.memory.map((item) =>
              item.id === memoryId ? admitted.value.record : item,
            ),
            memoryDecisions: [admitted.value.decision, ...state.memoryDecisions],
            learning: (state.learning ?? []).map((item) =>
              item.memoryId === memoryId
                ? { ...item, status: "admitted", closedAt: at }
                : item,
            ),
            activity: log(state, {
              kind: "memory.admitted",
              actor: "operator",
              summary: `Memoria admitida desde cuarentena: ${admitted.value.record.title}`,
              goalId: admitted.value.record.goalId,
              findingId: admitted.value.record.findingId,
              memoryId: admitted.value.record.id,
              correlationId: admitted.value.record.goalId,
              policy: "operator-admission",
            }),
          };
          const synced = syncKernel(next);
          return { ...next, ...synced };
        });
        return { ok: true };
      },
      rejectQuarantined: (memoryId, why) => {
        const record = get().memory.find((item) => item.id === memoryId);
        if (!record || record.lifecycle !== "quarantined") {
          return { ok: false, reason: "No hay una memoria en cuarentena con ese identificador." };
        }
        const at = nowIso();
        const rejected = transitionMemory(record, "rejected", {
          at,
          why: why.trim() || "Rechazada desde cuarentena.",
          actor: "operator",
          policy: "operator-admission",
          decisionId: shortId("md"),
        });
        if (!rejected.ok) return rejected;
        set((state) => {
          const next: KernelState = {
            ...state,
            memory: state.memory.map((item) =>
              item.id === memoryId ? rejected.value.record : item,
            ),
            memoryDecisions: [rejected.value.decision, ...state.memoryDecisions],
            learning: (state.learning ?? []).map((item) =>
              item.memoryId === memoryId
                ? { ...item, status: "rejected", closedAt: at }
                : item,
            ),
            activity: log(state, {
              kind: "memory.rejected",
              actor: "operator",
              summary: `Memoria rechazada desde cuarentena: ${rejected.value.record.title}`,
              goalId: rejected.value.record.goalId,
              findingId: rejected.value.record.findingId,
              memoryId: rejected.value.record.id,
              correlationId: rejected.value.record.goalId,
              policy: "operator-admission",
            }),
          };
          return next;
        });
        return { ok: true };
      },
      replaySeal: (sealId) => {
        const result = reconstructSeal(
          {
            goals: get().goals,
            evidence: get().evidence,
            findings: get().findings,
            memory: get().memory,
            memoryDecisions: get().memoryDecisions,
            dossiers: get().dossiers,
            contradictions: get().contradictions,
            learning: get().learning,
            learningDecisions: get().learningDecisions,
            confidence: get().confidence,
            activity: get().activity,
          },
          sealId,
        );
        set((state) => {
          const recorded = recordReplayActivity(state.activity ?? [], result, {
            now: nowIso(),
            nextId: () => shortId("a"),
          });
          if (!recorded.created) return state;
          return { activity: recorded.events };
        });
        return result;
      },
      exportKernel: () =>
        JSON.stringify(
          {
            exportedAt: nowIso(),
            product: "Efesto",
            goals: get().goals,
            evidence: get().evidence,
            findings: get().findings,
            memory: get().memory,
            memoryDecisions: get().memoryDecisions,
            dossiers: get().dossiers,
            watchPasses: get().watchPasses,
            contradictions: get().contradictions,
            learning: get().learning,
            learningDecisions: get().learningDecisions,
            confidence: get().confidence,
            activity: get().activity,
          },
          null,
          2,
        ),
      importKernel: (raw) => {
        const parsed = parseKernelSnapshot(raw);
        if (!parsed.ok) return parsed;
        const p = parsed.snapshot as Partial<KernelState>;
        set((current) => ({
          ...current,
          goals: (p.goals ?? []).map(withGoalDefaults),
          evidence: p.evidence ?? [],
          findings: p.findings ?? [],
          memory: (p.memory ?? []).map(withMemoryDefaults),
          memoryDecisions: p.memoryDecisions ?? [],
          dossiers: (p.dossiers ?? []).map(withDossierDefaults),
          watchPasses: p.watchPasses ?? [],
          contradictions: p.contradictions ?? [],
          learning: p.learning ?? [],
          learningDecisions: p.learningDecisions ?? [],
          confidence: p.confidence ?? [],
          activity: (p.activity ?? []).map((item) =>
            normalizeActivity({
              id: item.id,
              at: item.at,
              kind: item.kind,
              summary: item.summary,
              actor: item.actor,
              source: item.source,
              correlationId: item.correlationId,
              goalId: item.goalId,
              evidenceId: item.evidenceId,
              findingId: item.findingId,
              dossierId: item.dossierId,
              memoryId: item.memoryId,
              contradictionId: item.contradictionId,
              learningCandidateId: item.learningCandidateId,
              confidenceId: item.confidenceId,
              provenance: item.provenance,
              causal: item.causal,
              policy: item.policy,
              ai: item.ai,
            }),
          ),
        }));
        return { ok: true };
      },
      clearKernel: () => set({ ...empty }),
    }),
    {
      name: "efesto-kernel-v1",
      storage: memoryStorage,
      skipHydration: true,
      partialize: (state) => ({
        goals: state.goals,
        evidence: state.evidence,
        findings: state.findings,
        memory: state.memory,
        memoryDecisions: state.memoryDecisions,
        dossiers: state.dossiers,
        watchPasses: state.watchPasses,
        contradictions: state.contradictions,
        learning: state.learning,
        learningDecisions: state.learningDecisions,
        confidence: state.confidence,
        activity: state.activity,
        chat: state.chat,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<KernelState>;
        return {
          ...current,
          ...p,
          dossiers: (p.dossiers ?? []).map(withDossierDefaults),
          watchPasses: p.watchPasses ?? [],
          contradictions: p.contradictions ?? [],
          learning: p.learning ?? [],
          learningDecisions: p.learningDecisions ?? [],
          confidence: p.confidence ?? [],
          memory: (p.memory ?? []).map(withMemoryDefaults),
          memoryDecisions: p.memoryDecisions ?? [],
          goals: (p.goals ?? []).map(withGoalDefaults),
          activity: (p.activity ?? []).map((item) =>
            normalizeActivity({
              id: item.id,
              at: item.at,
              kind: item.kind,
              summary: item.summary,
              actor: item.actor,
              source: item.source,
              correlationId: item.correlationId,
              goalId: item.goalId,
              evidenceId: item.evidenceId,
              findingId: item.findingId,
              dossierId: item.dossierId,
              memoryId: item.memoryId,
              contradictionId: item.contradictionId,
              learningCandidateId: item.learningCandidateId,
              confidenceId: item.confidenceId,
              provenance: item.provenance,
              causal: item.causal,
              policy: item.policy,
              ai: item.ai,
            }),
          ),
        };
      },
    },
  ),
);

/** Client-only rehydrate so persist never fights React SSR snapshots. */
export function useHydrateKernel() {
  const [hydrated, setHydrated] = useState(() => useKernel.persist.hasHydrated());
  useEffect(() => {
    if (useKernel.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useKernel.persist.onFinishHydration(() => setHydrated(true));
    void useKernel.persist.rehydrate();
    return unsub;
  }, []);
  return hydrated;
}
