import type { MissionSummary, OpportunitySummary } from './contracts';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasHttpSourceUrl(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function missionSupportsEvidence(
  evidenceId: string,
  missions: readonly MissionSummary[] | undefined,
): boolean {
  if (!missions?.length || !evidenceId) return false;
  for (const mission of missions) {
    const results = mission.verificationResults;
    if (!Array.isArray(results)) continue;
    for (const entry of results) {
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      if (text(record.evidenceId) === evidenceId && record.supported === true) return true;
    }
  }
  return false;
}

/**
 * Fail-closed Kernel Find gate: Evidence+URL alone is not SUPPORT.
 * Requires an explicit supported stamp on the opportunity, or a mission
 * verificationResults entry with matching evidenceId and supported === true.
 */
export function isKernelSupportedFind(
  item: OpportunitySummary,
  missions?: readonly MissionSummary[],
): boolean {
  const title = text(item.title);
  const evidenceId = text(item.evidenceId);
  const sourceUrl = text(item.sourceUrl);
  if (!title || !evidenceId || !sourceUrl || item.status === 'dismissed') return false;
  if (!hasHttpSourceUrl(sourceUrl)) return false;
  if (item.supported === true) return true;
  if (missionSupportsEvidence(evidenceId, missions)) return true;
  return false;
}

export function kernelSupportedFinds(
  items: readonly OpportunitySummary[] | undefined,
  missions?: readonly MissionSummary[],
): OpportunitySummary[] {
  return (items ?? []).filter((item) => isKernelSupportedFind(item, missions));
}

/**
 * Mission-scoped Kernel SUPPORT Find count for Home forge-state-action.
 * Prefer verificationResults supported === true when present (raw Mission rows).
 * GoalSurface missions strip verificationResults and expose the same Kernel
 * SUPPORT total as findCount — use that so focusedGoalSurface.mission is honest.
 * Global inbox Finds must not brand a zero-SUPPORT forged focused mission.
 */
export function countMissionKernelSupportedFinds(mission?: unknown): number {
  if (!mission || typeof mission !== 'object') return 0;
  const record = mission as Record<string, unknown>;
  const results = record.verificationResults;
  if (Array.isArray(results)) {
    let n = 0;
    for (const entry of results) {
      if (!entry || typeof entry !== 'object') continue;
      if ((entry as Record<string, unknown>).supported === true) n += 1;
    }
    return n;
  }
  // Shared Goal Truth projection: findCount is already SUPPORT-only.
  const findCount = record.findCount;
  if (typeof findCount === 'number' && Number.isSafeInteger(findCount) && findCount >= 0) {
    return findCount;
  }
  return 0;
}
