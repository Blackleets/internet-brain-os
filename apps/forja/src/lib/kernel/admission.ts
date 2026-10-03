import { evidenceSupportsGoal, INCOMPLETE_SUPPORT_REASON, goalSupport, maySealGoal } from "./support.ts";
import type { Dossier, Evidence, Finding, MemoryRecord } from "./types.ts";

export type GateResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: string };

function isHttpsUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function findingKey(finding: Pick<Finding, "goalId" | "title" | "answer">) {
  return `${finding.goalId}\n${finding.title.trim().toLowerCase()}\n${finding.answer.trim().toLowerCase()}`;
}

export function duplicateFinding(existing: Finding[], candidate: Finding) {
  const key = findingKey(candidate);
  return existing.some((item) => findingKey(item) === key);
}

export function refuseEvidenceIdReuse(
  existing: Evidence[],
  candidate: Evidence,
): GateResult<Evidence> {
  const previous = existing.find((item) => item.id === candidate.id);
  if (!previous) return { ok: true, value: candidate };
  return {
    ok: false,
    reason: "El identificador de evidencia ya está admitido. No se reescribe.",
  };
}

export function refuseFindingIdReuse(
  existing: Finding[],
  candidate: Finding,
): GateResult<Finding> {
  const previous = existing.find((item) => item.id === candidate.id);
  if (!previous) return { ok: true, value: candidate };
  return {
    ok: false,
    reason: "El identificador de hallazgo ya está admitido. No se reescribe.",
  };
}

export function admitEvidence(
  candidate: Evidence,
  memory: MemoryRecord[] = [],
): GateResult<Evidence> {
  if (!candidate.id) return { ok: false, reason: "Evidence sin identificador." };
  if (memory.some((item) => item.id === candidate.id)) {
    return { ok: false, reason: "La memoria no es evidencia." };
  }
  if (!isHttpsUrl(candidate.url)) {
    return { ok: false, reason: "Solo se admite evidencia HTTPS pública." };
  }
  if (!candidate.excerpt.trim()) {
    return { ok: false, reason: "La evidencia no contiene material observado." };
  }
  if (!candidate.contentHash || candidate.contentHash.length < 16) {
    return { ok: false, reason: "Falta huella de integridad." };
  }
  if (!candidate.retrievedAt) {
    return { ok: false, reason: "Falta momento de recuperación." };
  }
  if (candidate.httpStatus < 200 || candidate.httpStatus >= 400) {
    return {
      ok: false,
      reason: `Recuperación no válida (HTTP ${candidate.httpStatus}).`,
    };
  }
  if (candidate.validation !== "retrieved") {
    return { ok: false, reason: "El Kernel no admite evidencia no recuperada." };
  }
  return { ok: true, value: candidate };
}

export function admitFinding(
  candidate: Finding,
  evidence: Evidence[],
  memory: MemoryRecord[] = [],
  goalText?: string,
): GateResult<Finding> {
  if (!candidate.title.trim() || !candidate.answer.trim()) {
    return { ok: false, reason: "Un hallazgo necesita título y respuesta." };
  }
  if (candidate.evidenceIds.length === 0) {
    return {
      ok: false,
      reason: "Un hallazgo no puede existir sin evidencia observada.",
    };
  }
  const memoryIds = new Set(memory.map((item) => item.id));
  const citedMemory = candidate.evidenceIds.filter((id) => memoryIds.has(id));
  if (citedMemory.length) {
    return {
      ok: false,
      reason: "Un hallazgo no puede citar memoria como evidencia.",
    };
  }
  const known = new Set(evidence.map((item) => item.id));
  const missing = candidate.evidenceIds.filter((id) => !known.has(id));
  if (missing.length) {
    return {
      ok: false,
      reason: "El hallazgo cita evidencia que el Kernel no admite.",
    };
  }
  if (goalText) {
    const cited = evidence.filter((item) => candidate.evidenceIds.includes(item.id));
    const supported = cited.filter((item) => evidenceSupportsGoal(goalText, item));
    if (!supported.length) {
      return {
        ok: false,
        reason: "El hallazgo cita evidencia recuperada que no demuestra el Goal. HTTP 200 no basta.",
      };
    }
  }
  return { ok: true, value: candidate };
}

export function admitMemory(
  candidate: MemoryRecord,
  finding: Finding | undefined,
): GateResult<MemoryRecord> {
  if (!finding) {
    return { ok: false, reason: "No hay hallazgo que admitir en memoria." };
  }
  if (finding.id !== candidate.findingId) {
    return { ok: false, reason: "La memoria no coincide con el hallazgo." };
  }
  if (candidate.why.trim().length < 8) {
    return {
      ok: false,
      reason: "La memoria exige una razón del operador (mínimo 8 caracteres).",
    };
  }
  if (candidate.evidenceIds.length === 0) {
    return { ok: false, reason: "La memoria exige procedencia de evidencia." };
  }
  const missing = candidate.evidenceIds.filter(
    (id) => !finding.evidenceIds.includes(id),
  );
  if (missing.length) {
    return {
      ok: false,
      reason: "La memoria no puede ampliar la evidencia del hallazgo.",
    };
  }
  if (candidate.id && finding.evidenceIds.includes(candidate.id)) {
    return { ok: false, reason: "La memoria no es evidencia." };
  }
  return { ok: true, value: candidate };
}

export function admitDossier(
  candidate: Dossier,
  findings: Finding[],
  evidence: Evidence[],
  memory: MemoryRecord[] = [],
  goalText?: string,
): GateResult<Dossier> {
  if (!candidate.goalId) return { ok: false, reason: "El dosier no está ligado a un caso." };
  if (!candidate.sealHash || candidate.sealHash.length < 16) {
    return { ok: false, reason: "El dosier no tiene sello criptográfico." };
  }
  if (!candidate.executive.trim()) {
    return { ok: false, reason: "Un dosier no se sella sin síntesis observada." };
  }
  if (candidate.findingIds.length === 0 || candidate.evidenceIds.length === 0) {
    return { ok: false, reason: "Un dosier exige hallazgos y evidencia del caso." };
  }
  const findingById = new Map(findings.map((item) => [item.id, item]));
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const memoryIds = new Set([
    ...memory.map((item) => item.id),
    ...candidate.known.map((item) => item.memoryId),
  ]);
  for (const id of candidate.findingIds) {
    const finding = findingById.get(id);
    if (!finding || finding.goalId !== candidate.goalId) {
      return { ok: false, reason: "El dosier cita un hallazgo que el Kernel no admite." };
    }
    if (finding.evidenceIds.some((evidenceId) => memoryIds.has(evidenceId))) {
      return { ok: false, reason: "Un hallazgo no puede citar memoria como evidencia." };
    }
  }
  for (const id of candidate.evidenceIds) {
    if (memoryIds.has(id)) {
      return { ok: false, reason: "El dosier no puede tratar memoria consultada como evidencia." };
    }
    const item = evidenceById.get(id);
    if (!item || item.goalId !== candidate.goalId) {
      return { ok: false, reason: "El dosier cita evidencia que el Kernel no admite." };
    }
  }
  if (!goalText?.trim()) {
    return { ok: false, reason: "El dosier no tiene Goal que demostrar." };
  }
  const citedEvidence = candidate.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => Boolean(item));
  const citedFindings = candidate.findingIds
    .map((id) => findingById.get(id))
    .filter((item): item is Finding => Boolean(item));
  const support = goalSupport({
    goalText,
    evidence: citedEvidence,
    findings: citedFindings,
  });
  if (!maySealGoal(support)) {
    return { ok: false, reason: support.reason || INCOMPLETE_SUPPORT_REASON };
  }
  return { ok: true, value: candidate };
}
