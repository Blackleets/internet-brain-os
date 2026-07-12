import type {
  Confidence,
  EntityId,
  RelationshipId,
} from '@internet-brain-os/shared';
import { InvalidEvidenceInputError } from './evidence-errors';

export function normalizeOptionalText(
  value: string | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function normalizeSourceUrl(
  value: string | null | undefined,
): string | undefined {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return undefined;

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new InvalidEvidenceInputError(
      'sourceUrl',
      value,
      'sourceUrl must be a valid HTTP or HTTPS URL',
    );
  }
}

export function normalizeContentHash(
  value: string | null | undefined,
): string | undefined {
  const normalized = normalizeOptionalText(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    throw new InvalidEvidenceInputError(
      'contentHash',
      value,
      'contentHash must be a 64-character SHA-256 hex digest',
    );
  }
  return normalized;
}

export function validateConfidence(value: Confidence): Confidence {
  const numeric = value as number;
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    throw new InvalidEvidenceInputError(
      'confidence',
      value,
      'confidence must be a finite number between 0 and 1',
    );
  }
  return value;
}

export function normalizeTags(
  values: readonly string[] | undefined,
): readonly string[] {
  return deduplicate(
    (values ?? []).map((value) => value.trim()).filter(Boolean),
  );
}

export function normalizeEntityIds(
  values: readonly EntityId[] | undefined,
): readonly EntityId[] {
  return deduplicate(values ?? []);
}

export function normalizeRelationshipIds(
  values: readonly RelationshipId[] | undefined,
): readonly RelationshipId[] {
  return deduplicate(values ?? []);
}

function deduplicate<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
