export const STATUS_LABELS = {
  retrieved: "Recuperada",
  rejected: "Rechazada",
  blocked: "Bloqueada",
  admitted: "Admitida",
  quarantined: "Cuarentena",
  proposed: "Propuesta",
  superseded: "Sustituida",
  revoked: "Revocada",
  low: "Confianza baja",
  medium: "Confianza media",
  high: "Confianza alta",
  researching: "Forjando",
  complete: "Completado",
  failed: "Fallido",
  draft: "Borrador",
  unverified: "Lead no verificado",
  interpretation: "Interpretado",
  evidence: "Evidencia",
  lead: "Pista",
  watched: "En vigilancia",
  novel: "Nuevo",
  confirmed: "Confirmado",
  tension: "Tensión",
  "evidence-evidence": "Evidencia contra evidencia",
  "memory-memory": "Memoria contra memoria",
  "evidence-memory": "Evidencia contra memoria",
  "interpretation-interpretation": "Interpretación distinta",
  reused: "Ya observada",
  sealed: "Sellado",
  stable: "Estable",
  changed: "Cambió",
  missing: "Ausente",
  vigente: "Vigente",
  prior: "Anterior",
  open: "Candidato",
  ready: "Listo",
  duplicate: "Duplicado",
  reinforcement: "Refuerzo",
  contradicted: "En tensión",
  refinement: "Precisión",
  contradiction: "Contradicción",
} as const;

export type StatusKind = keyof typeof STATUS_LABELS;

/** Visual tone only. Does not change Kernel meaning. */
export type StatusTone = "ok" | "warn" | "err" | "info";

const TONE: Record<StatusKind, StatusTone> = {
  retrieved: "ok",
  admitted: "ok",
  complete: "ok",
  confirmed: "ok",
  sealed: "ok",
  stable: "ok",
  vigente: "ok",
  high: "ok",
  interpretation: "ok",
  reinforcement: "ok",

  researching: "warn",
  watched: "warn",
  proposed: "warn",
  quarantined: "warn",
  changed: "warn",
  tension: "warn",
  contradicted: "warn",
  contradiction: "warn",
  "evidence-evidence": "warn",
  "memory-memory": "warn",
  "evidence-memory": "warn",
  "interpretation-interpretation": "warn",
  open: "warn",
  ready: "warn",
  low: "warn",
  missing: "warn",

  blocked: "err",
  rejected: "err",
  failed: "err",
  revoked: "err",

  draft: "info",
  medium: "info",
  unverified: "info",
  evidence: "info",
  lead: "info",
  novel: "info",
  reused: "info",
  prior: "info",
  superseded: "info",
  duplicate: "info",
  refinement: "info",
};

export function statusTone(kind: StatusKind): StatusTone {
  return TONE[kind];
}

/** Pulse only while work is in flight — never on a settled warning or error. */
export function statusPulses(kind: StatusKind): boolean {
  return kind === "researching";
}
