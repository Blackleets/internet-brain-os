import type { Case } from '@internet-brain-os/shared';
import { InvalidCaseInputError } from './case-errors';

export function normalizeRequiredText(
  field: 'title' | 'objective',
  value: string,
): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new InvalidCaseInputError(field, value, `${field} must not be empty`);
  }
  return normalized;
}

export function normalizeDescription(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function normalizeTags(
  tags: readonly string[] | undefined,
): readonly string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const rawTag of tags ?? []) {
    const tag = rawTag.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    normalized.push(tag);
  }

  return normalized;
}

export function canTransition(
  currentStatus: Case['status'],
  nextStatus: Case['status'],
): boolean {
  const transitions: Readonly<Record<Case['status'], readonly Case['status'][]>> = {
    draft: ['active', 'archived'],
    active: ['completed', 'archived'],
    completed: ['archived'],
    archived: [],
  };

  return transitions[currentStatus].includes(nextStatus);
}
