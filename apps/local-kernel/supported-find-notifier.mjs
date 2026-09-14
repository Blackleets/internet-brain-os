import { isKernelSupportedInboxFind } from './opportunity-classifier.mjs';

/**
 * Queue NotificationGateway entries for Kernel SUPPORT Finds only.
 * Same honesty as isKernelSupportedFind / isKernelSupportedInboxFind:
 * opportunity.supported === true OR matching verificationResults.supported === true.
 * No notify for Evidence-only, unsupported leads, Hermes received, or Completado fakes.
 */
export async function queueSupportedFindNotifications({
  gateway,
  mission,
  opportunities,
  createdAt,
  actor = 'system',
} = {}) {
  if (!gateway || typeof gateway.queue !== 'function' || !mission) return [];
  const missionEvidenceIds = supportedEvidenceIds(mission);
  if (!missionEvidenceIds.size) return [];

  const queued = [];
  const items = Array.isArray(opportunities) ? opportunities : [];
  for (const item of items) {
    if (!isKernelSupportedInboxFind(item, [mission])) continue;
    const evidenceId = typeof item?.evidenceId === 'string' ? item.evidenceId.trim() : '';
    if (!evidenceId || !missionEvidenceIds.has(evidenceId)) continue;

    const title = typeof item.title === 'string' ? item.title.trim().slice(0, 160) : 'Kernel SUPPORT Find';
    const sourceId = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `evidence:${evidenceId}`;
    const notification = await gateway.queue({
      dedupeKey: `find:supported:${sourceId}`,
      sourceType: 'opportunity',
      sourceId,
      ...(typeof mission.goalId === 'string' && mission.goalId.trim() ? { goalId: mission.goalId.trim() } : {}),
      evidenceIds: [evidenceId],
      title: title || 'Kernel SUPPORT Find',
      body: `${title || 'Find'} passed Kernel SUPPORT. Evidence retained — open Efesto to inspect.`,
      priority: 'high',
      actionRequired: true,
      createdAt: createdAt ?? new Date().toISOString(),
    }, actor);
    queued.push(notification);
  }
  return queued;
}

function supportedEvidenceIds(mission) {
  const ids = new Set();
  const results = mission?.verificationResults;
  if (!Array.isArray(results)) return ids;
  for (const entry of results) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.supported !== true) continue;
    const evidenceId = typeof entry.evidenceId === 'string' ? entry.evidenceId.trim() : '';
    if (evidenceId) ids.add(evidenceId);
  }
  return ids;
}
