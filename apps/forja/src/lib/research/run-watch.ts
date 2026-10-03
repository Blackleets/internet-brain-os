import { shortId } from "../utils.ts";
import { useKernel } from "../kernel/store.ts";
import { relatedMemory } from "../kernel/related-memory.ts";
import { classifyDelta } from "../kernel/delta.ts";
import { composeDossier, chooseInstrument, parentSealContext, sealsForGoal } from "../kernel/dossier.ts";

import {
  classifyReread,
  latestEvidenceByUrl,
  tallyObservations,
} from "../kernel/watch.ts";
import type { Evidence, Finding, WatchObservation, WatchPass } from "../kernel/types.ts";
import { resolveResearchIO, type ResearchIO } from "./io.ts";
import { useAI } from "../ai/store.ts";
import { recordAIInvocation } from "../ai/observe.ts";

function citedEvidenceIds(indexes: number[], corpus: Evidence[]): string[] {
  return indexes
    .map((index) => corpus[index]?.id)
    .filter((id): id is string => Boolean(id));
}

export async function runWatch(goalId: string, io?: ResearchIO) {
  const resolved = await resolveResearchIO(io);
  const kernel = useKernel.getState();
  const goal = kernel.goals.find((item) => item.id === goalId);
  if (!goal) return { status: "blocked" as const, reason: "El caso no está en el Kernel." };

  const latest = latestEvidenceByUrl(
    kernel.evidence.filter((item) => item.goalId === goalId && item.validation === "retrieved"),
  );
  if (!latest.length) {
    return { status: "blocked" as const, reason: "No hay evidencia que releer." };
  }

  const currentSeal = sealsForGoal(kernel.dossiers, goalId)[0];
  if (currentSeal) {
    const retrieved = kernel.evidence.filter(
      (item) => item.goalId === goalId && item.validation === "retrieved",
    );
    const relatedNow = relatedMemory(goal.text, kernel.memory, kernel.findings, goalId);
    const instrument = chooseInstrument(currentSeal, retrieved, relatedNow, kernel.memory);
    if (instrument === "REINTERPRETAR") {
      return {
        status: "blocked" as const,
        reason: "Cambió la memoria consultada. Reinterpretar, no releer.",
      };
    }
  }

  kernel.setGoalStage(goalId, "reading");

  const observations: WatchObservation[] = [];

  try {
    for (const prior of latest) {
      const read = await resolved.readPublicWeb({ data: { url: prior.url } });
      const status = classifyReread(
        prior.contentHash,
        read.ok
          ? { ok: true, contentHash: read.contentHash }
          : { ok: false, status: read.status === "BLOCKED" ? "BLOCKED" : "FAIL" },
      );

      const observation: WatchObservation = {
        url: prior.url,
        sourceHost: prior.sourceHost,
        previousHash: prior.contentHash,
        currentHash: read.ok ? read.contentHash : undefined,
        status,
        previousEvidenceId: prior.id,
      };

      if (read.ok && status === "changed") {
        const evidence: Evidence = {
          id: shortId("e"),
          goalId,
          url: read.url,
          title: read.title || prior.title,
          sourceHost: read.sourceHost,
          excerpt: read.excerpt,
          contentHash: read.contentHash,
          retrievedAt: read.retrievedAt,
          httpStatus: read.httpStatus,
          bytes: read.bytes,
          validation: "retrieved",
        };
        const gate = kernel.tryAdmitEvidence(evidence);
        if (gate.ok) observation.newEvidenceId = evidence.id;
      }

      observations.push(observation);
    }

    const tallies = tallyObservations(observations);
    const pass: WatchPass = {
      id: shortId("w"),
      goalId,
      at: new Date().toISOString(),
      observations,
      ...tallies,
    };
    kernel.recordWatchPass(pass);

    if (tallies.changed === 0) {
      kernel.setGoalStage(goalId, "complete");
      return { status: "stable" as const, pass };
    }

    const after = useKernel.getState();
    const corpus = latestEvidenceByUrl(
      after.evidence.filter((item) => item.goalId === goalId && item.validation === "retrieved"),
    );
    const related = relatedMemory(goal.text, after.memory, after.findings, goalId);
    const changedIds = new Set(
      observations
        .map((item) => item.newEvidenceId)
        .filter((id): id is string => Boolean(id)),
    );
    const interpretCorpus = corpus.filter((item) => changedIds.has(item.id));
    if (!interpretCorpus.length) interpretCorpus.push(...corpus);
    if (related.length) {
      kernel.markMemoryConsulted(
        related.map((hit) => hit.memory.id),
        goalId,
      );
    }
    const parentSeal = parentSealContext(goal, after.dossiers, after.findings, after.goals);

    kernel.setGoalStage(goalId, "interpreting");
    const interpretation = await resolved.interpretEvidence({
      data: {
        goal: goal.text,
        evidence: interpretCorpus.slice(0, 4).map((item) => ({
          title: item.title,
          url: item.url,
          excerpt: item.excerpt,
        })),
        memory: related.map((hit) => ({
          title: hit.memory.title,
          why: hit.memory.why,
        })),
        parentSeal,
        selection: useAI.getState().selection(),
      },
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

    const admittedFindings: Finding[] = [];
    if (interpretation.ok && interpretation.available) {
      for (const item of interpretation.findings) {
        const evidenceIds = citedEvidenceIds(item.evidenceIndexes, interpretCorpus);
        if (!evidenceIds.length) continue;
        const finding: Finding = {
          id: shortId("f"),
          goalId,
          title: item.title || "Hallazgo tras relectura",
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

    const sealed = useKernel.getState();
    const current = sealed.goals.find((item) => item.id === goalId);
    const findingsForSeal = admittedFindings.length
      ? admittedFindings
      : sealed.findings.filter((item) => item.goalId === goalId);
    if (current) {
      const dossier = await composeDossier({
        goal: current,
        findings: findingsForSeal,
        evidence: sealed.evidence.filter(
          (item) => item.goalId === goalId && item.validation === "retrieved",
        ),
        related,
      });
      if (dossier) {
        kernel.sealDossier(dossier);
        kernel.setGoalStage(goalId, "complete");
        return { status: "changed" as const, pass };
      }
    }

    kernel.setGoalStage(goalId, "complete");
    return { status: "changed" as const, pass };
  } catch (error) {
    kernel.setGoalStage(goalId, "complete");
    throw error;
  }
}
