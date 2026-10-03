import { shortId } from "../utils.ts";
import { useKernel } from "../kernel/store.ts";
import { relatedMemory } from "../kernel/related-memory.ts";
import { classifyDelta } from "../kernel/delta.ts";
import {
  chooseInstrument,
  composeDossier,
  memoryConsultIsStale,
  newSourcesNotInSeal,
  parentSealContext,
  sealedEvidence,
  sealedPlusNewEvidence,
  sealsForGoal,
} from "../kernel/dossier.ts";
import { normalizeUrl } from "../kernel/watch.ts";
import type { DeltaKind, DiscoverySnapshot, Evidence, Finding } from "../kernel/types.ts";
import { resolveResearchIO, type DiscoveryReport, type ResearchIO } from "./io.ts";
import { formatIncompleteReason, selectDiverseHits } from "./search-parse.ts";
import { planResearch } from "./planner.ts";
import { useAI } from "../ai/store.ts";
import { recordAIInvocation } from "../ai/observe.ts";
import { evidenceSupportsGoal, INCOMPLETE_SUPPORT_REASON } from "../kernel/support.ts";

function citedEvidenceIds(indexes: number[], corpus: Evidence[]): string[] {
  return indexes
    .map((index) => corpus[index]?.id)
    .filter((id): id is string => Boolean(id));
}

function snapshotOf(report?: DiscoveryReport, extra?: Partial<DiscoverySnapshot>): DiscoverySnapshot | undefined {
  if (!report && !extra) return undefined;
  return {
    queries: report?.queries ?? extra?.queries ?? [],
    providers:
      extra?.providers ??
      report?.providers?.map((probe) => ({
        name: probe.name,
        status: probe.status,
        hitCount: probe.hitCount,
        error: probe.error,
      })) ??
      [],
    found: extra?.found ?? report?.found ?? 0,
    usable: extra?.usable ?? report?.usable ?? 0,
    domains: extra?.domains ?? report?.domains ?? [],
    kinds: extra?.kinds ?? (report?.kinds as Record<string, number> | undefined),
    extracted: extra?.extracted ?? report?.extracted,
    readFailures: extra?.readFailures ?? report?.readFailures,
  };
}

async function interpretWithAI(
  resolved: ResearchIO,
  data: {
    goal: string;
    evidence: Array<{ title: string; url: string; excerpt: string }>;
    memory?: Array<{ title: string; why: string }>;
    parentSeal?: {
      goal: string;
      executive: string;
      findings: Array<{ title: string; answer: string }>;
    };
  },
  goalId: string,
) {
  const interpretation = await resolved.interpretEvidence({
    data: { ...data, selection: useAI.getState().selection() },
  });
  if (interpretation.invocation) {
    recordAIInvocation({
      result: interpretation.ok
        ? interpretation.available
          ? { ok: true, text: "", invocation: interpretation.invocation }
          : {
              ok: false,
              status: "BLOCKED",
              error: interpretation.reason,
              invocation: interpretation.invocation,
            }
        : {
            ok: false,
            status: interpretation.status,
            error: interpretation.error,
            invocation: interpretation.invocation,
          },
      correlationId: goalId,
      goalId,
    });
  }
  return interpretation;
}

export async function runInvestigation(goalId: string, goalText: string, io?: ResearchIO) {
  const resolved = await resolveResearchIO(io);
  const kernel = useKernel.getState();
  const plan = planResearch(goalText);
  kernel.setGoalStage(goalId, "searching", {
    discovery: {
      queries: plan.queries,
      providers: [],
      found: 0,
      usable: 0,
      domains: [],
    },
  });

  const related = relatedMemory(goalText, kernel.memory, kernel.findings, goalId);
  if (related.length) {
    kernel.markMemoryConsulted(
      related.map((hit) => hit.memory.id),
      goalId,
    );
  }

  const currentGoal = kernel.goals.find((item) => item.id === goalId);
  const parentSeal = currentGoal
    ? parentSealContext(currentGoal, kernel.dossiers, kernel.findings, kernel.goals)
    : undefined;

  const search = await resolved.searchPublicWeb({ data: { query: goalText } });
  if (!search.ok) {
    const discovery = snapshotOf(search.discovery);
    const reason = search.error.startsWith("Investigación incompleta")
      ? search.error
      : `Investigación incompleta en descubrimiento. ${search.error}`;
    kernel.setGoalLeads(goalId, [], { discovery });
    kernel.setGoalStage(goalId, "blocked", { blockedReason: reason, discovery });
    return { status: "blocked" as const, reason };
  }
  const discovery = snapshotOf(search.discovery, {
    found: search.discovery?.found ?? search.hits.length,
    usable: search.discovery?.usable ?? search.hits.length,
    domains: search.discovery?.domains ?? [...new Set(search.hits.map((hit) => hit.sourceHost))],
  });
  kernel.setGoalLeads(goalId, search.hits, { discovery });
  kernel.setGoalStage(goalId, "reading", { leadCount: search.hits.length, discovery });

  const admitted: Evidence[] = [];
  const snapshot = useKernel.getState();
  const already = new Set(
    snapshot.evidence
      .filter((item) => item.goalId === goalId)
      .map((item) => normalizeUrl(item.url)),
  );

  const chosen = selectDiverseHits(search.hits, goalText, { limit: 6, maxPerHost: 2 });
  const readFailures: string[] = [];
  const pending = chosen.filter((hit) => !already.has(normalizeUrl(hit.url)));
  for (let offset = 0; offset < pending.length && admitted.length < 3; offset += 3) {
    const batch = pending.slice(offset, offset + 3);
    const reads = await Promise.all(
      batch.map((hit) => resolved.readPublicWeb({ data: { url: hit.url } }).then((read) => ({ hit, read }))),
    );
    for (const { hit, read } of reads) {
      if (admitted.length >= 3) break;
      if (!read.ok) {
        readFailures.push(`${hit.sourceHost}: ${read.error}`);
        continue;
      }
      if (already.has(normalizeUrl(read.url))) continue;
      const prior = snapshot.evidence.find(
        (item) =>
          item.goalId !== goalId &&
          normalizeUrl(item.url) === normalizeUrl(read.url) &&
          item.contentHash === read.contentHash,
      );
      const evidence: Evidence = {
        id: shortId("e"),
        goalId,
        url: read.url,
        title: read.title || hit.title,
        sourceHost: read.sourceHost,
        excerpt: read.excerpt,
        contentHash: read.contentHash,
        retrievedAt: read.retrievedAt,
        httpStatus: read.httpStatus,
        bytes: read.bytes,
        validation: "retrieved",
        reused: Boolean(prior),
      };
      const gate = kernel.tryAdmitEvidence(evidence);
      if (gate.ok) {
        admitted.push(evidence);
        already.add(normalizeUrl(evidence.url));
      }
    }
    kernel.setGoalStage(goalId, "reading", {
      leadCount: search.hits.length,
      discovery: snapshotOf(search.discovery, {
        extracted: admitted.length,
        readFailures,
      }),
    });
  }

  if (!admitted.length) {
    const prior = useKernel
      .getState()
      .evidence.filter((item) => item.goalId === goalId);
    if (!prior.length) {
      const phaseReport = snapshotOf(search.discovery, {
        extracted: 0,
        readFailures,
        usable: chosen.length,
        found: search.discovery?.found ?? search.hits.length,
        domains: search.discovery?.domains ?? [...new Set(search.hits.map((hit) => hit.sourceHost))],
      });
      const reason =
        (phaseReport
          ? formatIncompleteReason(
              {
                queries: phaseReport.queries,
                providers: phaseReport.providers.map((probe) => ({
                  name: probe.name,
                  status: probe.status,
                  hitCount: probe.hitCount,
                  error: probe.error,
                  recoverable: true,
                })),
                found: phaseReport.found,
                usable: phaseReport.usable,
                domains: phaseReport.domains,
                kinds: {},
                extracted: 0,
                readFailures,
              },
              "recuperación de evidencia",
            )
          : "Investigación incompleta. Se encontraron pistas, pero ninguna fuente pública pudo validarse como evidencia.") +
        (readFailures.length ? ` Lecturas: ${readFailures.join(" ")}` : "");
      kernel.setGoalLeads(goalId, search.hits, { discovery: phaseReport });
      kernel.setGoalStage(goalId, "blocked", { blockedReason: reason, discovery: phaseReport });
      return { status: "blocked" as const, reason };
    }
  }

  const corpus =
    admitted.length > 0
      ? admitted
      : useKernel.getState().evidence.filter((item) => item.goalId === goalId);

  kernel.setGoalStage(goalId, "interpreting", {
    leadCount: search.hits.length,
    discovery: snapshotOf(search.discovery, {
      extracted: corpus.length,
      readFailures,
    }),
  });
  const interpretation = await interpretWithAI(
    resolved,
    {
      goal: goalText,
      evidence: corpus.slice(0, 6).map((item) => ({
        title: item.title,
        url: item.url,
        excerpt: item.excerpt,
      })),
      memory: related.map((hit) => ({
        title: hit.memory.title,
        why: hit.memory.why,
      })),
      parentSeal,
    },
    goalId,
  );

  if (interpretation.ok && interpretation.available) {
    for (const item of interpretation.findings) {
      const evidenceIds = citedEvidenceIds(item.evidenceIndexes, corpus);
      if (!evidenceIds.length) continue;
      const finding: Finding = {
        id: shortId("f"),
        goalId,
        title: item.title || "Hallazgo",
        answer: item.answer,
        whyItMatters: item.whyItMatters,
        confidence: item.confidence,
        evidenceIds,
        uncertainties: item.uncertainties,
        nextAction: item.nextAction,
        interpretationAvailable: true,
        createdAt: new Date().toISOString(),
      };
      const delta = classifyDelta(
        finding,
        related,
        item.memoryRelation
          ? { kind: item.memoryRelation, note: item.memoryNote }
          : undefined,
      );
      if (delta) {
        finding.delta = delta.kind;
        finding.deltaNote = delta.note;
        finding.deltaMemoryId = delta.memoryId;
      }
      kernel.tryAdmitFinding(finding);
    }
  }

  const afterFindings = useKernel
    .getState()
    .findings.filter((item) => item.goalId === goalId);
  const supportedCorpus = corpus.filter((item) => evidenceSupportsGoal(goalText, item));
  if (!afterFindings.length && supportedCorpus.length) {
    const gap =
      interpretation.ok && !interpretation.available
        ? interpretation.reason
        : interpretation.ok
          ? "La interpretación no citó evidencia verificable."
          : interpretation.error;
    const finding: Finding = {
      id: shortId("f"),
      goalId,
      title: "Fuentes recuperadas",
      answer: `Se retuvo evidencia de ${supportedCorpus.length} fuente(s). La interpretación automática no estuvo disponible: ${gap}`,
      whyItMatters:
        "La evidencia observada existe aunque el modelo no haya interpretado.",
      confidence: "low",
      evidenceIds: supportedCorpus.map((item) => item.id),
      uncertainties: [gap],
      nextAction: related.length
        ? "Hay memoria previa relacionada. Ábrela aparte; no sustituye a esta evidencia."
        : "Abrir la evidencia y decidir si merece memoria.",
      interpretationAvailable: false,
      createdAt: new Date().toISOString(),
    };
    const delta = classifyDelta(finding, related);
    if (delta) {
      finding.delta = delta.kind;
      finding.deltaNote = delta.note;
      finding.deltaMemoryId = delta.memoryId;
    }
    kernel.tryAdmitFinding(finding);
  }

  const after = useKernel.getState();
  const liveGoal = after.goals.find((item) => item.id === goalId);
  const discoveryAfter = snapshotOf(search.discovery, {
    extracted: corpus.length,
    readFailures,
  });
  if (liveGoal) {
    const dossier = await composeDossier({
      goal: liveGoal,
      findings: after.findings.filter((item) => item.goalId === goalId),
      evidence: after.evidence.filter((item) => item.goalId === goalId),
      related,
    });
    if (dossier) {
      kernel.sealDossier(dossier);
      kernel.setGoalStage(goalId, "complete", {
        leadCount: search.hits.length,
        discovery: discoveryAfter,
      });
      return { status: "complete" as const };
    }
  }

  const reason = INCOMPLETE_SUPPORT_REASON;
  kernel.setGoalStage(goalId, "blocked", {
    blockedReason: reason,
    leadCount: search.hits.length,
    discovery: discoveryAfter,
  });
  return { status: "blocked" as const, reason };
}

export async function startCase(
  text: string,
  source?: { goalId: string; dossierId: string },
  onOpen?: (goal: { id: string }) => void,
  io?: ResearchIO,
) {
  const trimmed = text.trim();
  if (trimmed.length < 3) {
    return { ok: false as const, reason: "El objetivo es demasiado corto." };
  }
  const kernel = useKernel.getState();
  if (source?.dossierId) {
    const existing = kernel.goals.find((item) => item.spawnedFromDossierId === source.dossierId);
    if (existing) {
      onOpen?.(existing);
      return { ok: true as const, goal: existing, created: false as const };
    }
  }
  const goal = kernel.createGoal(trimmed, source);
  onOpen?.(goal);
  await runInvestigation(goal.id, trimmed, io);
  return { ok: true as const, goal, created: true as const };
}

export async function readLead(goalId: string, url: string, io?: ResearchIO) {
  const resolved = await resolveResearchIO(io);
  const kernel = useKernel.getState();
  const goal = kernel.goals.find((item) => item.id === goalId);
  if (!goal) return { ok: false as const, reason: "El caso no está en el Kernel." };
  const key = normalizeUrl(url);
  const already = kernel.evidence.some(
    (item) => item.goalId === goalId && normalizeUrl(item.url) === key,
  );
  if (already) {
    return { ok: false as const, reason: "Esta URL ya está retenida para el objetivo." };
  }
  const read = await resolved.readPublicWeb({ data: { url } });
  if (!read.ok) {
    return { ok: false as const, reason: read.error };
  }
  const prior = kernel.evidence.find(
    (item) =>
      item.goalId !== goalId &&
      normalizeUrl(item.url) === normalizeUrl(read.url) &&
      item.contentHash === read.contentHash,
  );
  const evidence: Evidence = {
    id: shortId("e"),
    goalId,
    url: read.url,
    title: read.title,
    sourceHost: read.sourceHost,
    excerpt: read.excerpt,
    contentHash: read.contentHash,
    retrievedAt: read.retrievedAt,
    httpStatus: read.httpStatus,
    bytes: read.bytes,
    validation: "retrieved",
    reused: Boolean(prior),
  };
  const gate = kernel.tryAdmitEvidence(evidence);
  if (!gate.ok) return { ok: false as const, reason: gate.reason };
  return { ok: true as const, evidence };
}

/** Interpret uncovered evidence and reseal. Does not re-fetch sealed URLs. */
export async function incorporateUncovered(goalId: string, io?: ResearchIO) {
  const resolved = await resolveResearchIO(io);
  const kernel = useKernel.getState();
  const goal = kernel.goals.find((item) => item.id === goalId);
  if (!goal) return { status: "blocked" as const, reason: "El caso no está en el Kernel." };

  const currentSeal = sealsForGoal(kernel.dossiers, goalId)[0];
  if (!currentSeal) {
    return { status: "blocked" as const, reason: "No hay sello que actualizar." };
  }

  const retrieved = kernel.evidence.filter(
    (item) => item.goalId === goalId && item.validation === "retrieved",
  );
  const related = relatedMemory(goal.text, kernel.memory, kernel.findings, goalId);
  const uncovered = newSourcesNotInSeal(currentSeal, retrieved);
  const instrument = chooseInstrument(currentSeal, retrieved, related, kernel.memory);
  if (instrument === "RELEER") {
    return {
      status: "blocked" as const,
      reason: "Las fuentes selladas cambiaron. Releer, no incorporar.",
    };
  }
  if (instrument === "REINTERPRETAR") {
    return {
      status: "blocked" as const,
      reason: "Cambió la memoria consultada. Reinterpretar, no incorporar.",
    };
  }
  if (instrument !== "INCORPORAR" || !uncovered.length) {
    return { status: "stable" as const };
  }

  if (related.length) {
    kernel.markMemoryConsulted(
      related.map((hit) => hit.memory.id),
      goalId,
    );
  }
  const parentSeal = parentSealContext(goal, kernel.dossiers, kernel.findings, kernel.goals);

  kernel.setGoalStage(goalId, "interpreting");
  const interpretation = await interpretWithAI(
    resolved,
    {
      goal: goal.text,
      evidence: uncovered.slice(0, 4).map((item) => ({
        title: item.title,
        url: item.url,
        excerpt: item.excerpt,
      })),
      memory: related.map((hit) => ({
        title: hit.memory.title,
        why: hit.memory.why,
      })),
      parentSeal,
    },
    goalId,
  );

  if (interpretation.ok && interpretation.available) {
    for (const item of interpretation.findings) {
      const evidenceIds = citedEvidenceIds(item.evidenceIndexes, uncovered);
      if (!evidenceIds.length) continue;
      const finding: Finding = {
        id: shortId("f"),
        goalId,
        title: item.title || "Hallazgo de fuente incorporada",
        answer: item.answer,
        whyItMatters: item.whyItMatters,
        confidence: item.confidence,
        evidenceIds,
        uncertainties: item.uncertainties,
        nextAction: item.nextAction,
        interpretationAvailable: true,
        createdAt: new Date().toISOString(),
      };
      const delta = classifyDelta(
        finding,
        related,
        item.memoryRelation
          ? { kind: item.memoryRelation, note: item.memoryNote }
          : undefined,
      );
      if (delta) {
        finding.delta = delta.kind;
        finding.deltaNote = delta.note;
        finding.deltaMemoryId = delta.memoryId;
      }
      kernel.tryAdmitFinding(finding);
    }
  }

  const after = useKernel.getState();
  const corpus = sealedPlusNewEvidence(
    currentSeal,
    after.evidence.filter((item) => item.goalId === goalId && item.validation === "retrieved"),
  );
  const current = after.goals.find((item) => item.id === goalId);
  if (current) {
    const dossier = await composeDossier({
      goal: current,
      findings: after.findings.filter((item) => item.goalId === goalId),
      evidence: corpus,
      related,
    });
    if (dossier) {
      kernel.sealDossier(dossier);
      kernel.setGoalStage(goalId, "complete");
      return { status: "incorporated" as const, uncovered: uncovered.length };
    }
  }
  kernel.setGoalStage(goalId, "blocked", { blockedReason: INCOMPLETE_SUPPORT_REASON });
  return { status: "blocked" as const, reason: INCOMPLETE_SUPPORT_REASON, uncovered: uncovered.length };
}

/** Same evidence, current memory. Does not re-fetch. Memory is not evidence. */
export async function reinterpretWithMemory(goalId: string, io?: ResearchIO) {
  const resolved = await resolveResearchIO(io);
  const kernel = useKernel.getState();
  const goal = kernel.goals.find((item) => item.id === goalId);
  if (!goal) return { status: "blocked" as const, reason: "El caso no está en el Kernel." };

  const currentSeal = sealsForGoal(kernel.dossiers, goalId)[0];
  if (!currentSeal) {
    return { status: "blocked" as const, reason: "No hay sello que actualizar." };
  }

  const retrieved = kernel.evidence.filter(
    (item) => item.goalId === goalId && item.validation === "retrieved",
  );
  const related = relatedMemory(goal.text, kernel.memory, kernel.findings, goalId);
  const instrument = chooseInstrument(currentSeal, retrieved, related, kernel.memory);
  if (instrument === "RELEER") {
    return {
      status: "blocked" as const,
      reason: "Las fuentes selladas cambiaron. Releer, no reinterpretar.",
    };
  }
  if (instrument === "INCORPORAR") {
    return {
      status: "blocked" as const,
      reason: "Hay fuentes nuevas. Incorporar, no reinterpretar.",
    };
  }
  if (!memoryConsultIsStale(currentSeal, related, kernel.memory)) {
    return { status: "stable" as const };
  }

  const corpus = sealedEvidence(currentSeal, kernel.evidence);
  if (!corpus.length) {
    return { status: "blocked" as const, reason: "No hay evidencia que reinterpretar." };
  }

  if (related.length) {
    kernel.markMemoryConsulted(
      related.map((hit) => hit.memory.id),
      goalId,
    );
  }
  const parentSeal = parentSealContext(goal, kernel.dossiers, kernel.findings, kernel.goals);

  kernel.setGoalStage(goalId, "interpreting");
  const interpretation = await interpretWithAI(
    resolved,
    {
      goal: goal.text,
      evidence: corpus.slice(0, 4).map((item) => ({
        title: item.title,
        url: item.url,
        excerpt: item.excerpt,
      })),
      memory: related.map((hit) => ({
        title: hit.memory.title,
        why: hit.memory.why,
      })),
      parentSeal,
    },
    goalId,
  );

  const admittedFindings: Finding[] = [];
  if (interpretation.ok && interpretation.available) {
    for (const item of interpretation.findings) {
      const evidenceIds = citedEvidenceIds(item.evidenceIndexes, corpus);
      if (!evidenceIds.length) continue;
      const finding: Finding = {
        id: shortId("f"),
        goalId,
        title: item.title || "Hallazgo con memoria vigente",
        answer: item.answer,
        whyItMatters: item.whyItMatters,
        confidence: item.confidence,
        evidenceIds,
        uncertainties: item.uncertainties,
        nextAction: item.nextAction,
        interpretationAvailable: true,
        createdAt: new Date().toISOString(),
      };
      const delta = classifyDelta(
        finding,
        related,
        item.memoryRelation
          ? { kind: item.memoryRelation, note: item.memoryNote }
          : undefined,
      );
      if (delta) {
        finding.delta = delta.kind;
        finding.deltaNote = delta.note;
        finding.deltaMemoryId = delta.memoryId;
      }
      const gate = kernel.tryAdmitFinding(finding);
      if (gate.ok) admittedFindings.push(finding);
    }
  }

  const after = useKernel.getState();
  const findingsForSeal = admittedFindings.length
    ? admittedFindings
    : after.findings.filter((item) => item.goalId === goalId);
  const current = after.goals.find((item) => item.id === goalId);
  if (current) {
    const dossier = await composeDossier({
      goal: current,
      findings: findingsForSeal,
      evidence: corpus,
      related,
    });
    if (dossier) {
      kernel.sealDossier(dossier);
      kernel.setGoalStage(goalId, "complete");
      return { status: "reinterpreted" as const };
    }
  }
  kernel.setGoalStage(goalId, "blocked", { blockedReason: INCOMPLETE_SUPPORT_REASON });
  return { status: "blocked" as const, reason: INCOMPLETE_SUPPORT_REASON };
}

export type { DeltaKind };
