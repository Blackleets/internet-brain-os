import { requestMissionCandidateVerification } from './automatic-mission-verification-client.mjs';

const MAX_RECOVERY_DELAY_MS = 31 * 60_000;

export async function recoverAutomaticMissions(options = {}) {
  const baseUrl = normalizeLoopback(options.baseUrl ?? 'http://127.0.0.1:4000');
  const apiToken = requireValue(options.apiToken, 'apiToken');
  const fetchImpl = options.fetchImpl ?? fetch;
  const startMission = options.startMission;
  if (typeof startMission !== 'function') throw new Error('startMission is required');
  const verifyMission = options.verifyMission ?? ((missionId) => requestMissionCandidateVerification({ baseUrl, apiToken, missionId, fetchImpl }));
  const schedule = options.schedule ?? scheduleTimer;
  const now = options.now ?? (() => new Date());

  const response = await fetchImpl(`${baseUrl}/api/agent-missions`, {
    method: 'GET',
    headers: { 'x-hephaestus-token': apiToken },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.missions)) throw new Error(body.error ?? 'Unable to reconcile persisted Missions');

  const result = { queued: 0, verifying: 0, scheduled: 0, skipped: 0 };
  for (const mission of body.missions) {
    if (!mission?.id) { result.skipped += 1; continue; }
    if (mission.status === 'running' && mission.executionPhase === 'verifying' && Array.isArray(mission.searchCandidates) && mission.searchCandidates.length) {
      await verifyMission(mission.id);
      result.verifying += 1;
      continue;
    }
    if (mission.status === 'queued') {
      startMission(mission, apiToken);
      result.queued += 1;
      continue;
    }
    if (mission.status === 'running' && mission.executionPhase === 'investigating') {
      const expiresAt = Date.parse(mission.leaseExpiresAt);
      const delay = expiresAt - now().getTime();
      if (Number.isFinite(delay) && delay > 0 && delay <= MAX_RECOVERY_DELAY_MS) {
        schedule(() => startMission(mission, apiToken), delay + 50);
        result.scheduled += 1;
        continue;
      }
    }
    result.skipped += 1;
  }
  return result;
}

function scheduleTimer(callback, delay) {
  const timer = setTimeout(callback, delay);
  timer.unref?.();
  return timer;
}

function normalizeLoopback(value) {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Kernel URL must be loopback HTTP');
  return url.href.replace(/\/$/, '');
}
function requireValue(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error(`${name} is invalid`);
  return value.trim();
}
