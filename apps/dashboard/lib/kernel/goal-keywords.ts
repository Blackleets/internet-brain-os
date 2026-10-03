import { isGoalStopword } from '../forge/goal-terms';

/**
 * Keywords the dashboard sends with a new Goal: the distinct words of the Goal line (longer than two
 * letters), without the stopwords the Kernel SUPPORT check ignores anyway ("quiero", "busca", "para"…).
 * A line made only of stopwords keeps them (the Kernel rejects a Goal without keywords or categories).
 * Same stopword list as packages/kernel/src/evidence/support.ts, so no SUPPORT term is ever dropped.
 */
export function keywordsFromGoal(value: string): string[] {
  const words = value.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}]+/gu, ' ').split(/\s+/).filter((word) => word.length > 2);
  const subject = words.filter((word) => !isGoalStopword(word));
  // A Goal line made only of stopwords keeps its words: the Kernel needs at least one keyword.
  return Array.from(new Set(subject.length ? subject : words)).slice(0, 8);
}
