import { sealCause, sealsForGoal } from "./dossier.ts";
import { isAdmittedMemory } from "./authority.ts";
import { normalizeUrl } from "./watch.ts";
import type {
  Contradiction,
  ContradictionDraft,
  ContradictionKind,
  ContradictionPole,
  Dossier,
  Evidence,
  Finding,
  MemoryRecord,
} from "./types.ts";

export function contradictionKey(item: Pick<ContradictionDraft, "kind" | "left" | "right">) {
  const a = `${item.left.kind}:${item.left.id}`;
  const b = `${item.right.kind}:${item.right.id}`;
  return a < b ? `${item.kind}:${a}:${b}` : `${item.kind}:${b}:${a}`;
}

export function contradictionLabel(kind: ContradictionKind) {
  if (kind === "evidence-evidence") return "Evidencia contra evidencia";
  if (kind === "memory-memory") return "Memoria contra memoria";
  if (kind === "evidence-memory") return "Evidencia contra memoria";
  return "Interpretación distinta";
}

export function polesAreValid(item: Pick<ContradictionDraft, "kind" | "left" | "right">) {
  if (item.kind === "evidence-evidence") {
    return item.left.kind === "evidence" && item.right.kind === "evidence";
  }
  if (item.kind === "memory-memory") {
    return item.left.kind === "memory" && item.right.kind === "memory";
  }
  if (item.kind === "evidence-memory") {
    const kinds = [item.left.kind, item.right.kind];
    return kinds.includes("evidence") && kinds.includes("memory");
  }
  return item.left.kind === "seal" && item.right.kind === "seal";
}

function memoryPole(
  memoryId: string,
  memory: MemoryRecord[],
  dossiers: Dossier[],
): ContradictionPole {
  const live = memory.find((item) => item.id === memoryId);
  if (live) {
    return { kind: "memory", id: live.id, label: live.title };
  }
  for (const dossier of dossiers) {
    const snap = dossier.known.find((item) => item.memoryId === memoryId);
    if (snap) {
      return {
        kind: "memory",
        id: snap.memoryId,
        label: snap.title,
        fingerprint: snap.whyHash,
      };
    }
  }
  return { kind: "memory", id: memoryId, label: "Memoria histórica" };
}

function evidencePole(item: Evidence): ContradictionPole {
  return {
    kind: "evidence",
    id: item.id,
    label: item.title,
    fingerprint: item.contentHash,
  };
}

function evidenceEvidencePairs(evidence: Evidence[]): ContradictionDraft[] {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    if (item.validation !== "retrieved") continue;
    const key = `${item.goalId}:${normalizeUrl(item.url)}`;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const drafts: ContradictionDraft[] = [];
  for (const group of groups.values()) {
    const ordered = group
      .slice()
      .sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt) || a.id.localeCompare(b.id));
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1];
      const next = ordered[i];
      if (previous.contentHash === next.contentHash) continue;
      drafts.push({
        kind: "evidence-evidence",
        goalId: next.goalId,
        left: evidencePole(previous),
        right: evidencePole(next),
        note: `La fuente ${next.sourceHost} ya no tenía la misma huella.`,
        open: true,
      });
    }
  }
  return drafts;
}

function evidenceMemoryPairs(
  findings: Finding[],
  evidence: Evidence[],
  memory: MemoryRecord[],
  dossiers: Dossier[],
): ContradictionDraft[] {
  const byId = new Map(evidence.map((item) => [item.id, item]));
  const drafts: ContradictionDraft[] = [];
  for (const finding of findings) {
    if (finding.delta !== "tension" || !finding.deltaMemoryId) continue;
    const cited = finding.evidenceIds
      .map((id) => byId.get(id))
      .filter((item): item is Evidence => item != null && item.validation === "retrieved");
    const source = cited[0];
    if (!source) continue;
    const prior = memoryPole(finding.deltaMemoryId, memory, dossiers);
    drafts.push({
      kind: "evidence-memory",
      goalId: finding.goalId,
      left: evidencePole(source),
      right: prior,
      note:
        finding.deltaNote?.trim() ||
        `La evidencia de este caso tensiona la memoria admitida: ${prior.label}`,
      findingId: finding.id,
      open: memory.some((item) => item.id === finding.deltaMemoryId && isAdmittedMemory(item)),
    });
  }
  return drafts;
}

function memoryMemoryPairs(
  findings: Finding[],
  memory: MemoryRecord[],
  dossiers: Dossier[],
): ContradictionDraft[] {
  const drafts: ContradictionDraft[] = [];
  for (const finding of findings) {
    if (finding.delta !== "tension" || !finding.deltaMemoryId) continue;
    const admitted = memory.find((item) => item.findingId === finding.id);
    if (!admitted || admitted.id === finding.deltaMemoryId) continue;
    const prior = memoryPole(finding.deltaMemoryId, memory, dossiers);
    drafts.push({
      kind: "memory-memory",
      goalId: finding.goalId,
      left: { kind: "memory", id: admitted.id, label: admitted.title },
      right: prior,
      note: `Dos memorias admitidas entran en tensión: «${admitted.title}» y «${prior.label}».`,
      findingId: finding.id,
      open: memory.some((item) => item.id === prior.id && isAdmittedMemory(item)),
    });
  }
  return drafts;
}

function interpretationPairs(dossiers: Dossier[]): ContradictionDraft[] {
  const goalIds = [...new Set(dossiers.map((item) => item.goalId))];
  const drafts: ContradictionDraft[] = [];
  for (const goalId of goalIds) {
    const chain = sealsForGoal(dossiers, goalId);
    for (let i = 0; i < chain.length - 1; i += 1) {
      const newer = chain[i];
      const older = chain[i + 1];
      const cause = sealCause(newer, older);
      if (cause === "evidence") continue;
      const knownChanged = cause === "memory" || cause === "both";
      drafts.push({
        kind: "interpretation-interpretation",
        goalId,
        left: {
          kind: "seal",
          id: older.id,
          label: older.executive.trim().slice(0, 80) || older.sealHash,
          fingerprint: older.memoryContextHash || older.sealHash,
        },
        right: {
          kind: "seal",
          id: newer.id,
          label: newer.executive.trim().slice(0, 80) || newer.sealHash,
          fingerprint: newer.memoryContextHash || newer.sealHash,
        },
        note: knownChanged
          ? newer.executive.trim() !== older.executive.trim()
            ? "Cambió la memoria consultada y la síntesis."
            : "Cambió la memoria consultada."
          : "La lectura cambió.",
        sealId: newer.id,
        open: false,
        at: newer.sealedAt,
        closedAt: newer.sealedAt,
      });
    }
  }
  return drafts;
}

export function classifyContradictions(input: {
  evidence: Evidence[];
  findings: Finding[];
  memory: MemoryRecord[];
  dossiers: Dossier[];
}): ContradictionDraft[] {
  return [
    ...evidenceEvidencePairs(input.evidence),
    ...evidenceMemoryPairs(input.findings, input.evidence, input.memory, input.dossiers),
    ...memoryMemoryPairs(input.findings, input.memory, input.dossiers),
    ...interpretationPairs(input.dossiers),
  ].filter(polesAreValid);
}

function closedAtFor(
  previous: Contradiction | undefined,
  draft: ContradictionDraft,
  now: string,
): string | undefined {
  if (draft.open) return previous?.closedAt;
  if (draft.closedAt) return previous?.closedAt ?? draft.closedAt;
  if (previous?.closedAt) return previous.closedAt;
  if (previous?.open === false) return previous.closedAt ?? previous.at ?? now;
  if (previous?.open === true) return now;
  return now;
}

export function mergeContradictions(
  existing: Contradiction[],
  derived: ContradictionDraft[],
  opts: { now: string; nextId: () => string },
): Contradiction[] {
  const byKey = new Map(existing.map((item) => [contradictionKey(item), item]));
  const out: Contradiction[] = [];
  const seen = new Set<string>();
  for (const draft of derived) {
    if (!polesAreValid(draft)) continue;
    const key = contradictionKey(draft);
    if (seen.has(key)) continue;
    seen.add(key);
    const previous = byKey.get(key);
    out.push({
      ...draft,
      id: previous?.id ?? opts.nextId(),
      at: previous?.at ?? draft.at ?? opts.now,
      closedAt: closedAtFor(previous, draft, opts.now),
    });
  }
  for (const previous of existing) {
    const key = contradictionKey(previous);
    if (seen.has(key)) continue;
    if (previous.kind === "evidence-evidence") continue;
    out.push({
      ...previous,
      open: false,
      closedAt: previous.closedAt ?? opts.now,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** Reconstruct open/closed at a historical instant. Never uses a later close as if it were then. */
export function contradictionAsOf(item: Contradiction, at: string): Contradiction | null {
  if (item.at > at) return null;
  const open = !item.closedAt || item.closedAt > at;
  return {
    ...item,
    open,
    closedAt: open ? undefined : item.closedAt,
  };
}

export function openContradictions(records: Contradiction[]) {
  return records.filter((item) => item.open);
}

export function contradictionsTouching(
  records: Contradiction[],
  ref: {
    findingId?: string;
    sealId?: string;
    memoryId?: string;
    evidenceId?: string;
    goalId?: string;
  },
) {
  return records.filter((item) => {
    if (ref.findingId && item.findingId === ref.findingId) return true;
    if (ref.sealId && (item.sealId === ref.sealId || item.left.id === ref.sealId || item.right.id === ref.sealId)) {
      return true;
    }
    if (ref.memoryId) {
      if (item.left.kind === "memory" && item.left.id === ref.memoryId) return true;
      if (item.right.kind === "memory" && item.right.id === ref.memoryId) return true;
    }
    if (ref.evidenceId) {
      if (item.left.kind === "evidence" && item.left.id === ref.evidenceId) return true;
      if (item.right.kind === "evidence" && item.right.id === ref.evidenceId) return true;
    }
    if (ref.goalId && item.goalId === ref.goalId) return true;
    return false;
  });
}
