import type { Evidence, Finding, Goal } from "./types.ts";

export const KERNEL_SNAPSHOT_KEYS = [
  "goals",
  "evidence",
  "findings",
  "memory",
  "memoryDecisions",
  "dossiers",
  "watchPasses",
  "contradictions",
  "learning",
  "learningDecisions",
  "confidence",
  "activity",
] as const;

export type KernelSnapshot = {
  exportedAt?: string;
  product?: string;
  goals?: unknown;
  evidence?: unknown;
  findings?: unknown;
  memory?: unknown;
  memoryDecisions?: unknown;
  dossiers?: unknown;
  watchPasses?: unknown;
  contradictions?: unknown;
  learning?: unknown;
  learningDecisions?: unknown;
  confidence?: unknown;
  activity?: unknown;
};

export function parseKernelSnapshot(
  raw: string,
): { ok: true; snapshot: KernelSnapshot } | { ok: false; reason: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "El archivo no es JSON." };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, reason: "El archivo no es un núcleo de Efesto." };
  }
  const row = data as KernelSnapshot & { product?: unknown };
  if (row.product != null && row.product !== "Efesto") {
    return { ok: false, reason: "Ese archivo no es un núcleo de Efesto." };
  }
  for (const key of KERNEL_SNAPSHOT_KEYS) {
    if (row[key] != null && !Array.isArray(row[key])) {
      return { ok: false, reason: `El campo ${key} no es una lista.` };
    }
  }
  const hasKernel =
    Array.isArray(row.goals) || Array.isArray(row.evidence) || Array.isArray(row.findings) || Array.isArray(row.dossiers);
  if (!hasKernel) {
    return { ok: false, reason: "El archivo no contiene un núcleo." };
  }
  return { ok: true, snapshot: row };
}


export function findingToMarkdown(
  finding: Finding,
  evidence: Evidence[],
  goal?: Goal,
): string {
  const sources = evidence
    .filter((item) => finding.evidenceIds.includes(item.id))
    .map(
      (item) =>
        `- ${item.title} — ${item.url}\n  huella: \`${item.contentHash}\` · HTTP ${item.httpStatus} · ${item.retrievedAt}`,
    )
    .join("\n");

  return [
    `# ${finding.title}`,
    "",
    goal ? `Objetivo: ${goal.text}` : null,
    `Confianza: ${finding.confidence}`,
    `Interpretación automática: ${finding.interpretationAvailable ? "sí" : "no"}`,
    "",
    "## Respuesta",
    finding.answer,
    "",
    "## Por qué importa",
    finding.whyItMatters,
    finding.uncertainties.length
      ? `\n## Incierto\n${finding.uncertainties.map((item) => `- ${item}`).join("\n")}`
      : null,
    finding.nextAction ? `\n## Siguiente\n${finding.nextAction}` : null,
    "",
    "## Evidencia retenida",
    sources || "- (sin fuentes vinculadas)",
    "",
    "_Exportado desde Efesto. El modelo interpreta; el Kernel admite._",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function downloadText(
  filename: string,
  text: string,
  mime = "text/plain;charset=utf-8",
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function slugFile(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "hallazgo"
  );
}
