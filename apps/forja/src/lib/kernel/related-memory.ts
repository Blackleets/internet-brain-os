import type { Finding, MemoryRecord } from "./types.ts";
import { admittedMemory } from "./authority.ts";


const STOP = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "que",
  "qué",
  "y",
  "o",
  "en",
  "para",
  "con",
  "por",
  "es",
  "al",
  "lo",
  "se",
  "su",
  "sus",
  "más",
  "como",
  "esta",
  "este",
  "esto",
  "esa",
  "ese",
  "eso",
  "hay",
  "son",
  "una",
  "the",
  "and",
  "of",
  "for",
  "to",
  "in",
  "on",
  "a",
  "an",
  "is",
  "are",
  "this",
  "that",
  "with",
  "from",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export type RelatedMemoryHit = {
  memory: MemoryRecord;
  score: number;
  overlap: number;
};

export function relatedMemory(
  goalText: string,
  memory: MemoryRecord[],
  findings: Finding[] = [],
  excludeGoalId?: string,
): RelatedMemoryHit[] {
  const query = new Set(tokenize(goalText));
  const usable = admittedMemory(memory);
  const pool = excludeGoalId
    ? usable.filter((record) => record.goalId !== excludeGoalId)
    : usable;
  if (query.size === 0 || pool.length === 0) return [];

  return pool
    .map((record) => {
      const finding = findings.find((item) => item.id === record.findingId);
      const blob = [record.title, record.why, finding?.title, finding?.answer]
        .filter(Boolean)
        .join(" ");
      const tokens = tokenize(blob);
      const overlap = tokens.filter((token) => query.has(token)).length;
      const uniqueOverlap = new Set(tokens.filter((token) => query.has(token))).size;
      const score = uniqueOverlap / query.size;
      return { memory: record, score, overlap };
    })
    .filter((hit) => hit.overlap >= 1 && hit.score >= 0.12)
    .sort((a, b) => b.score - a.score || b.overlap - a.overlap)
    .slice(0, 3);
}
