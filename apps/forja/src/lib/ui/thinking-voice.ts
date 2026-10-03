import type { IntelligenceState } from "./working-copy.ts";

export function thinkingVoice(input: {
  state: IntelligenceState;
  model?: string;
  agent?: { label: string } | null;
  live?: boolean;
}): { actor: string; mode: string; line: string } {
  const agent = input.agent?.label?.trim() || null;
  const model = input.model?.trim() || null;

  if (input.state === "error") {
    return {
      actor: agent || "Efesto",
      mode: "Investigación incompleta",
      line: "El Kernel no inventó fuentes.",
    };
  }

  if (input.state === "completed") {
    return {
      actor: agent || "Efesto",
      mode: agent ? "Forjado" : "Completado",
      line: agent
        ? `${agent} recibió el sello. El bot no admite.`
        : model
          ? `El Kernel retuvo lo observado. ${model} no admite.`
          : "El Kernel retuvo lo observado.",
    };
  }

  const mode = modeForState(input.state);

  if (agent) {
    if (mode === "Pensando" || mode === "Comprobando" || mode === "Sellando") {
      return {
        actor: agent,
        mode,
        line: `${agent} espera al Kernel. El modelo no admite.`,
      };
    }
    return {
      actor: agent,
      mode: "Forjando",
      line: `${agent} está conectado. El Kernel busca en la web pública.`,
    };
  }

  if (mode === "Pensando" && model) {
    return {
      actor: model,
      mode: "Pensando",
      line: `${model} interpreta extractos. El Kernel admite.`,
    };
  }

  if ((mode === "Comprobando" || mode === "Sellando") && model) {
    return {
      actor: model,
      mode,
      line: `${model} interpreta extractos. El Kernel admite.`,
    };
  }

  return {
    actor: "Efesto",
    mode,
    line: model ? `El Kernel busca. ${model} interpretará extractos.` : "El Kernel busca en la web pública.",
  };
}

function modeForState(state: IntelligenceState): string {
  switch (state) {
    case "thinking":
      return "Pensando";
    case "searching":
    case "discovering":
    case "investigating":
      return "Forjando";
    case "analyzing":
    case "verifying":
      return "Comprobando";
    case "evidence":
    case "generating":
      return "Sellando";
    case "completed":
      return "Completado";
    case "error":
      return "Investigación incompleta";
  }
}
