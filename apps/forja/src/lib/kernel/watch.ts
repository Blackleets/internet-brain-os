import { tokenize } from "./related-memory.ts";
import { latestDossierByGoal } from "./dossier.ts";
import { isAdmittedMemory } from "./authority.ts";
import type {
  Dossier,
  Evidence,
  Finding,
  Goal,
  MemoryRecord,
  WatchObservation,
  WatchPass,
  WatchStatus,
} from "./types.ts";


export function normalizeUrl(url: string) {
  return url.replace(/\/$/, "");
}

/** Watch history is append-only. The Kernel does not truncate it. */
export const WATCH_HISTORY_POLICY = Object.freeze({
  truncate: false as const,
  note: "El historial de relectura no se recorta. El único límite es el del almacenamiento del entorno.",
});

export function duplicateObservation(existing: Evidence[], candidate: Evidence): boolean {
  const url = normalizeUrl(candidate.url);
  return existing.some(
    (item) =>
      item.goalId === candidate.goalId &&
      normalizeUrl(item.url) === url &&
      item.contentHash === candidate.contentHash,
  );
}

export function latestEvidenceByUrl(evidence: Evidence[]): Evidence[] {
  const map = new Map<string, Evidence>();
  for (const item of evidence) {
    const key = normalizeUrl(item.url);
    const prev = map.get(key);
    if (!prev || prev.retrievedAt < item.retrievedAt) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => a.sourceHost.localeCompare(b.sourceHost));
}

export function classifyReread(
  previousHash: string,
  read:
    | { ok: true; contentHash: string }
    | { ok: false; status: "BLOCKED" | "FAIL" },
): WatchStatus {
  if (!read.ok) return read.status === "BLOCKED" ? "blocked" : "missing";
  return read.contentHash === previousHash ? "stable" : "changed";
}

export function watchSummary(pass: Pick<WatchPass, "stable" | "changed" | "missing" | "blocked">) {
  const parts: string[] = [];
  if (pass.stable) parts.push(`${pass.stable} estable${pass.stable === 1 ? "" : "s"}`);
  if (pass.changed) parts.push(`${pass.changed} ${pass.changed === 1 ? "cambió" : "cambiaron"}`);
  if (pass.missing) parts.push(`${pass.missing} ausente${pass.missing === 1 ? "" : "s"}`);
  if (pass.blocked) parts.push(`${pass.blocked} bloqueada${pass.blocked === 1 ? "" : "s"}`);
  return parts.join(" · ") || "Sin observaciones";
}

export function tallyObservations(observations: WatchObservation[]) {
  return {
    stable: observations.filter((item) => item.status === "stable").length,
    changed: observations.filter((item) => item.status === "changed").length,
    missing: observations.filter((item) => item.status === "missing").length,
    blocked: observations.filter((item) => item.status === "blocked").length,
  };
}

export type RelatedDossierHit = {
  dossier: Dossier;
  goalText: string;
  score: number;
  kind: "related" | "tension";
  note: string;
};

export function relatedDossiers(input: {
  goalId: string;
  goalText: string;
  dossiers: Dossier[];
  goals: Goal[];
  findings: Finding[];
  memory?: MemoryRecord[];
}): RelatedDossierHit[] {
  const query = new Set(tokenize(input.goalText));
  const ownFindings = input.findings.filter((item) => item.goalId === input.goalId);
  for (const finding of ownFindings) {
    for (const token of tokenize(`${finding.title} ${finding.answer}`)) query.add(token);
  }

  const tensionGoalIds = new Set<string>();
  for (const finding of ownFindings) {
    if (finding.delta !== "tension" || !finding.deltaMemoryId || !input.memory) continue;
    const record = input.memory.find((item) => item.id === finding.deltaMemoryId);
    if (record && record.goalId !== input.goalId && isAdmittedMemory(record)) {
      tensionGoalIds.add(record.goalId);
    }
  }

  const ownMemoryIds = new Set(
    (input.memory ?? [])
      .filter((item) => item.goalId === input.goalId && isAdmittedMemory(item))
      .map((item) => item.id),
  );
  const reverseTensionGoalIds = new Set<string>();
  for (const finding of input.findings) {
    if (finding.goalId === input.goalId) continue;
    if (finding.delta !== "tension" || !finding.deltaMemoryId) continue;
    if (ownMemoryIds.has(finding.deltaMemoryId)) reverseTensionGoalIds.add(finding.goalId);
  }

  if (input.dossiers.length === 0) return [];
  if (query.size === 0 && reverseTensionGoalIds.size === 0) return [];

  const pool = latestDossierByGoal(input.dossiers);

  return pool
    .filter((dossier) => dossier.goalId !== input.goalId)
    .map((dossier) => {
      const goal = input.goals.find((item) => item.id === dossier.goalId);
      const otherFindings = input.findings.filter((item) => item.goalId === dossier.goalId);
      const blob = [
        goal?.text,
        dossier.executive,
        ...otherFindings.map((item) => `${item.title} ${item.answer}`),
      ]
        .filter(Boolean)
        .join(" ");
      const tokens = tokenize(blob);
      const uniqueOverlap = new Set(tokens.filter((token) => query.has(token))).size;
      const overlap = tokens.filter((token) => query.has(token)).length;
      const score = query.size ? uniqueOverlap / query.size : 0;
      const forward = tensionGoalIds.has(dossier.goalId);
      const reverse = reverseTensionGoalIds.has(dossier.goalId);
      const tension = forward || reverse;
      return {
        dossier,
        goalText: goal?.text ?? "Caso sellado",
        score,
        overlap,
        kind: tension ? ("tension" as const) : ("related" as const),
        note: forward
          ? "Un hallazgo de este caso tensiona memoria de aquel."
          : reverse
            ? "Un hallazgo de aquel caso tensiona memoria de este."
            : "Mismo terreno. No es evidencia de este caso.",
      };
    })
    .filter((hit) => hit.kind === "tension" || (hit.overlap >= 1 && hit.score >= 0.12))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "tension" ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 3)
    .map(({ overlap: _overlap, ...hit }) => hit);
}

export type OpenTension = {
  findingId: string;
  findingTitle: string;
  note: string;
  fromGoalId: string;
  fromGoalText: string;
  toGoalId: string;
  toGoalText: string;
  memoryId: string;
  memoryTitle: string;
};

/** Later findings that contradict admitted memory from another case. */
export function openTensions(input: {
  findings: Finding[];
  memory: MemoryRecord[];
  goals: Goal[];
}): OpenTension[] {
  const memoryById = new Map(input.memory.map((item) => [item.id, item]));
  const goalById = new Map(input.goals.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const rows: OpenTension[] = [];
  for (const finding of input.findings) {
    if (finding.delta !== "tension" || !finding.deltaMemoryId) continue;
    const record = memoryById.get(finding.deltaMemoryId);
    if (!record || record.goalId === finding.goalId || !isAdmittedMemory(record)) continue;
    const key = `${finding.id}:${record.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      findingId: finding.id,
      findingTitle: finding.title,
      note: finding.deltaNote?.trim() ?? "",
      fromGoalId: finding.goalId,
      fromGoalText: goalById.get(finding.goalId)?.text ?? "Caso",
      toGoalId: record.goalId,
      toGoalText: goalById.get(record.goalId)?.text ?? "Caso",
      memoryId: record.id,
      memoryTitle: record.title,
    });
  }
  return rows.slice(0, 4);
}
