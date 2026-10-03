/** Local prepare state. Creating a Goal still requires explicit confirmation. */
export function prepareGoal(text: string): { ok: true; text: string } | { ok: false; reason: string } {
  const value = text.trim();
  if (value.length < 3) {
    return { ok: false, reason: "Escribe qué debe forjar Efesto." };
  }
  return { ok: true, text: value };
}

export const MEMORY_UNAVAILABLE = {
  title: "Memoria no disponible",
  body: "La memoria solo existe si el Kernel la admite. El chat nunca entra aquí.",
} as const;

export const GOLDEN_PATH = [
  "Pregunta",
  "Goal",
  "Preparar",
  "Confirmar",
  "Forjar",
  "Evidencia",
  "Hallazgos",
  "Case",
] as const;
