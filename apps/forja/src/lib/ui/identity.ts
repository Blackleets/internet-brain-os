import type { GoalStatus, ResearchStage } from "../kernel/types.ts";

export type WorkingKind = "investigate" | "chat" | "reread";

export type IdentityPhase =
  | "thinking"
  | "forging"
  | "checking"
  | "sealing"
  | "completed"
  | "incomplete";

export type IdentityStep = {
  id: Exclude<IdentityPhase, "incomplete">;
  label: string;
  state: "done" | "active" | "pending";
};

export const IDENTITY_LABEL: Record<IdentityPhase, string> = {
  thinking: "Pensando",
  forging: "Forjando",
  checking: "Comprobando",
  sealing: "Sellando",
  completed: "Completado",
  incomplete: "Investigación incompleta",
};

const HUMAN_LINE: Record<ResearchStage, string> = {
  understood: "Preparando el resultado",
  searching: "Investigando fuentes públicas",
  reading: "Verificando evidencia",
  verifying: "Comprobando contradicciones",
  interpreting: "Contrastando hallazgos",
  complete: "El Kernel retuvo lo observado.",
  blocked: "Investigación incompleta. El Kernel no inventó fuentes.",
  failed: "Investigación incompleta. El Kernel no inventó fuentes.",
};

export function identityPhase(input: {
  kind: WorkingKind;
  stage?: ResearchStage;
  sealed?: boolean;
  finished?: boolean;
}): IdentityPhase {
  if (input.kind === "chat") return "thinking";
  if (input.stage === "blocked" || input.stage === "failed") return "incomplete";
  if (input.sealed || input.finished) return "completed";
  if (input.stage === "complete") return "incomplete";
  if (input.kind === "reread") {
    if (input.stage === "interpreting") return "checking";
    return "forging";
  }
  switch (input.stage) {
    case "understood":
      return "thinking";
    case "searching":
    case "reading":
      return "forging";
    case "verifying":
    case "interpreting":
      return "checking";
    default:
      return "thinking";
  }
}

export function identityLabel(phase: IdentityPhase): string {
  return IDENTITY_LABEL[phase];
}

export function identityLine(input: {
  kind: WorkingKind;
  stage?: ResearchStage;
  model?: string;
}): string {
  if (input.kind === "chat") {
    return input.model
      ? `${input.model} responde. Esto no es evidencia.`
      : "El modelo responde. Esto no es evidencia.";
  }
  if (input.kind === "reread") {
    if (input.stage === "interpreting") return "Contrastando hallazgos";
    if (input.stage === "complete") return "La relectura quedó en el Kernel.";
    return "Releyendo fuentes admitidas…";
  }
  if (input.stage) return HUMAN_LINE[input.stage];
  return "Esperando un resultado real…";
}

/** Five identity states. Kernel artifacts decide done/active — never a fake checklist. */
export function identitySteps(input: {
  stage: ResearchStage;
  status: GoalStatus;
  leadCount: number;
  evidenceCount: number;
  findingCount: number;
  sealed: boolean;
}): { steps: IdentityStep[]; phase: IdentityPhase } {
  const failed =
    input.stage === "blocked" ||
    input.stage === "failed" ||
    input.status === "blocked" ||
    input.status === "failed";
  const phase = identityPhase({
    kind: "investigate",
    stage: input.stage,
    sealed: input.sealed,
    finished: input.sealed,
  });
  const thinkingDone = input.leadCount > 0 || input.stage !== "understood";
  const forgingDone = input.evidenceCount > 0 || (input.leadCount > 0 && input.stage !== "searching" && input.stage !== "understood");
  const checkingDone = input.findingCount > 0;
  const sealingDone = input.sealed;
  const completedDone = input.sealed;

  function step(
    id: IdentityStep["id"],
    done: boolean,
    active: boolean,
  ): IdentityStep {
    return {
      id,
      label: IDENTITY_LABEL[id],
      state: done ? "done" : active ? "active" : "pending",
    };
  }

  return {
    phase: failed ? "incomplete" : phase,
    steps: [
      step("thinking", thinkingDone, !failed && !thinkingDone),
      step("forging", forgingDone, !failed && thinkingDone && !forgingDone),
      step("checking", checkingDone, !failed && forgingDone && !checkingDone),
      step("sealing", sealingDone, !failed && checkingDone && !sealingDone),
      step("completed", completedDone, !failed && sealingDone && !completedDone),
    ],
  };
}
