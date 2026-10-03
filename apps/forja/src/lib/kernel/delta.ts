import type { DeltaKind, Finding, MemoryRecord } from "./types.ts";

import { tokenize, type RelatedMemoryHit } from "./related-memory.ts";
import { isAdmittedMemory } from "./authority.ts";

export type DeltaHint = {
  kind: DeltaKind;
  note?: string;
};

export type ClassifiedDelta = {
  kind: DeltaKind;
  memoryId?: string;
  note: string;
};

function pickRelated(related: RelatedMemoryHit[], hint?: DeltaHint): RelatedMemoryHit {
  const top = related[0];
  if (!hint?.note?.trim() || related.length === 1) return top;
  const noteTokens = new Set(tokenize(hint.note));
  if (noteTokens.size === 0) return top;
  let best = top;
  let bestOverlap = -1;
  for (const hit of related) {
    const blob = tokenize(`${hit.memory.title} ${hit.memory.why}`);
    const overlap = blob.filter((token) => noteTokens.has(token)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = hit;
    }
  }
  return bestOverlap > 0 ? best : top;
}

/**
 * Knowledge delta is relative to admitted memory, never to the model.
 * Tension is refused unless the interpreter named a conflict AND related
 * memory actually exists. Empty memory → no delta (nothing to compare).
 */
export function classifyDelta(
  finding: Pick<Finding, "title" | "answer">,
  related: RelatedMemoryHit[],
  hint?: DeltaHint,
): ClassifiedDelta | null {
  if (related.length === 0) return null;

  const best = pickRelated(related, hint);
  if (hint?.kind === "tension") {
    return {
      kind: "tension",
      memoryId: best.memory.id,
      note:
        hint.note?.trim() ||
        `La evidencia de este caso tensiona la memoria admitida: ${best.memory.title}`,
    };
  }
  if (hint?.kind === "confirmed") {
    return {
      kind: "confirmed",
      memoryId: best.memory.id,
      note:
        hint.note?.trim() ||
        `Coincide con memoria admitida: ${best.memory.title}`,
    };
  }
  if (hint?.kind === "novel") {
    return {
      kind: "novel",
      memoryId: best.memory.id,
      note:
        hint.note?.trim() ||
        "La memoria previa es cercana, pero este hallazgo aporta material nuevo.",
    };
  }

  if (best.score >= 0.3) {
    return {
      kind: "confirmed",
      memoryId: best.memory.id,
      note: `Coincide con memoria admitida: ${best.memory.title}`,
    };
  }

  return {
    kind: "novel",
    memoryId: best.memory.id,
    note: `Cercano a «${best.memory.title}», pero no estaba retenido así.`,
  };
}

export function findingBlob(finding: Pick<Finding, "title" | "answer">) {
  return `${finding.title} ${finding.answer}`;
}

/** Memory of another case that this finding still tensions. Not evidence. */
export function tensedMemory(finding: Finding, memory: MemoryRecord[]) {
  if (finding.delta !== "tension" || !finding.deltaMemoryId) return undefined;
  const prior = memory.find((item) => item.id === finding.deltaMemoryId);
  if (!prior || prior.goalId === finding.goalId || !isAdmittedMemory(prior)) return undefined;
  return prior;
}
