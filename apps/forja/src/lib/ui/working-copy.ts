import type { GoalStatus, ResearchStage } from "../kernel/types.ts";
import {
  identityLabel,
  identityLine,
  identityPhase,
  type WorkingKind as IdentityKind,
} from "./identity.ts";

export type WorkingKind = IdentityKind;

export type ProgressState = "done" | "active" | "pending";

export type ProgressStep = {
  id: "search" | "read" | "interpret" | "contradict" | "support" | "case" | "learn" | "complete";
  label: string;
  state: ProgressState;
};

export type IntelligenceState =
  | "thinking"
  | "searching"
  | "discovering"
  | "investigating"
  | "analyzing"
  | "verifying"
  | "evidence"
  | "generating"
  | "completed"
  | "error";

export type WorkingGlyph = IntelligenceState;

const INTELLIGENCE_LABEL: Record<IntelligenceState, string> = {
  thinking: "Pensando",
  searching: "Buscando",
  discovering: "Descubriendo",
  investigating: "Investigando",
  analyzing: "Analizando",
  verifying: "Verificando",
  evidence: "Construyendo evidencia",
  generating: "Generando",
  completed: "Completado",
  error: "Error",
};

export function intelligenceLabel(state: IntelligenceState): string {
  return INTELLIGENCE_LABEL[state];
}

export function intelligenceStateFromStep(id: ProgressStep["id"]): IntelligenceState {
  switch (id) {
    case "search":
      return "searching";
    case "read":
      return "discovering";
    case "interpret":
      return "analyzing";
    case "contradict":
      return "verifying";
    case "support":
      return "evidence";
    case "case":
    case "learn":
      return "generating";
    case "complete":
      return "completed";
  }
}

export function workingHeadline(
  kind: WorkingKind,
  stage?: ResearchStage,
  finished?: boolean,
): string {
  return identityLabel(identityPhase({ kind, stage, finished }));
}

/**
 * Subtitle bound to a real Kernel stage or chat wait.
 * Never claims a step that is not happening.
 */
export function workingDetail(
  kind: WorkingKind,
  stage?: ResearchStage,
  model?: string,
): string {
  return identityLine({ kind, stage, model });
}

export function workingGlyph(
  kind: WorkingKind,
  stage?: ResearchStage,
  steps?: ProgressStep[],
  finished?: boolean,
): IntelligenceState {
  if (kind === "chat") return "thinking";
  if (stage === "blocked" || stage === "failed") return "error";
  if (finished) return "completed";
  const active = steps?.find((step) => step.state === "active");
  if (active) return intelligenceStateFromStep(active.id);
  if (kind === "reread") {
    if (stage === "interpreting") return "analyzing";
    return "investigating";
  }
  switch (stage) {
    case "understood":
      return "thinking";
    case "searching":
      return "searching";
    case "reading":
      return "investigating";
    case "verifying":
      return "verifying";
    case "interpreting":
      return "analyzing";
    default:
      return "searching";
  }
}

export function investigationSummary(input: {
  leadCount: number;
  evidenceCount: number;
  findingCount: number;
  contradictionCount: number;
  found?: number;
  usable?: number;
  domainCount?: number;
}): string {
  if (input.found != null && input.usable != null && input.domainCount != null) {
    return `Fuentes encontradas: ${input.found}. Utilizables: ${input.usable}. Dominios: ${input.domainCount}. Evidencias extraídas: ${input.evidenceCount}.`;
  }
  const hallazgo = input.findingCount === 1 ? "hallazgo" : "hallazgos";
  const contradiccion = input.contradictionCount === 1 ? "contradicción" : "contradicciones";
  return `${input.leadCount} fuentes · ${input.evidenceCount} evidencias · ${input.findingCount} ${hallazgo} · ${input.contradictionCount} ${contradiccion}`;
}

export function discoveryCopy(input: {
  found: number;
  usable: number;
  domainCount: number;
  extracted: number;
}): string {
  return `Fuentes encontradas: ${input.found}. Utilizables: ${input.usable}. Dominios: ${input.domainCount}. Evidencias extraídas: ${input.extracted}.`;
}

export function investigationSteps(input: {
  stage: ResearchStage;
  status: GoalStatus;
  leadCount: number;
  evidenceCount: number;
  findingCount: number;
  contradictionCount: number;
  confidenceCount?: number;
  learningCount?: number;
  sealed: boolean;
}): { steps: ProgressStep[]; summary?: string } {
  const failed = input.stage === "blocked" || input.stage === "failed" || input.status === "blocked" || input.status === "failed";
  const searchDone = input.leadCount > 0;
  const evidenceDone = input.evidenceCount > 0;
  const interpretDone = input.findingCount > 0;
  // Kernel always evaluates contradictions when it admits findings.
  const contradictDone = interpretDone;
  const supportDone = (input.confidenceCount ?? 0) > 0 || input.sealed;
  const caseDone = input.sealed;
  // sealDossier proposes learning; the artifact may be empty, the check still ran.
  const learnDone = input.sealed || (input.learningCount ?? 0) > 0;
  const completeDone = input.sealed;

  const searchActive = !failed && !searchDone && (input.stage === "searching" || input.stage === "understood");
  const readActive = !failed && searchDone && !evidenceDone && (input.stage === "reading" || input.stage === "verifying");
  const interpretActive = !failed && evidenceDone && !interpretDone && input.stage === "interpreting";
  const contradictActive = !failed && interpretDone && !contradictDone;
  const supportActive = !failed && contradictDone && !supportDone;
  const caseActive = !failed && !caseDone && supportDone;
  const learnActive = !failed && caseDone && !learnDone;
  const completeActive = !failed && !completeDone && learnDone;

  function step(id: ProgressStep["id"], label: string, done: boolean, active: boolean): ProgressStep {
    return { id, label, state: done ? "done" : active ? "active" : "pending" };
  }

  const finished = input.sealed;
  return {
    steps: [
      step("search", "Buscando fuentes", searchDone, searchActive),
      step("read", "Recuperando evidencia", evidenceDone, readActive),
      step("interpret", "Analizando hallazgos", interpretDone, interpretActive),
      step("contradict", "Comprobando contradicciones", contradictDone, contradictActive),
      step("support", "Evaluando soporte", supportDone, supportActive),
      step("case", "Sellando caso", caseDone, caseActive),
      step("learn", "Proponiendo aprendizaje", learnDone, learnActive),
      step("complete", "Completado", completeDone, completeActive),
    ],
    summary: finished || failed
      ? investigationSummary({
          leadCount: input.leadCount,
          evidenceCount: input.evidenceCount,
          findingCount: input.findingCount,
          contradictionCount: input.contradictionCount,
        })
      : undefined,
  };
}
