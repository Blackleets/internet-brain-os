export async function requestMissionCandidateVerification(options = {}) {
  const baseUrl = normalizeLoopback(options.baseUrl ?? 'http://127.0.0.1:4000');
  const apiToken = requireValue(options.apiToken, 'apiToken');
  const missionId = requireValue(options.missionId, 'missionId');
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl}/api/agent-missions/${encodeURIComponent(missionId)}/results`, {
    method: 'POST',
    headers: { 'x-hephaestus-token': apiToken, 'content-type': 'application/json' },
    body: JSON.stringify({ resultKind: 'verify_candidates' }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Kernel verification request failed with HTTP ${response.status}`);
  if (!body?.mission?.id || body.mission.id !== missionId) throw new Error('Kernel verification response did not contain the requested Mission');
  return body.mission;
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
