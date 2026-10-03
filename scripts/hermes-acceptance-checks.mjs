import { ACCEPTANCE_ORIGIN, api } from './hermes-acceptance-lib.mjs';

export const HOSTILE_URLS = [
  'http://127.0.0.1:4000/api/goals',
  'http://localhost/admin',
  'http://10.0.0.5/internal',
  'http://192.168.1.1/router',
  'http://172.16.4.9/private',
  'http://169.254.169.254/latest/meta-data/',
  'http://[::1]/loopback',
  'http://[fd00::1]/ula',
  'http://[fe80::1]/link-local',
  'https://user:secret@example.com/leak',
  'file:///etc/passwd',
  'https://example.com/callback?access_token=abcdef123456',
  'http://2130706433/decimal-loopback',
  'http://0x7f000001/hex-loopback',
  'http://127.1/short-loopback',
  'http://100.64.0.1/cgnat',
  'http://198.18.0.1/benchmark',
  'http://192.0.0.1/ietf-protocol',
  'http://[::ffff:127.0.0.1]/mapped-loopback',
  'http://[::ffff:10.0.0.1]/mapped-private',
];

function finding(url, extra = {}) {
  return {
    url,
    title: 'Acceptance probe finding',
    text: 'Bounded public text used only to exercise Kernel validation during acceptance.',
    ...extra,
  };
}

// After #238 the only agent intake that admits URLs is resultKind:'search_candidates'
// (candidates, never Evidence); bare findings are refused as AGENT_FINDINGS_NOT_EVIDENCE.
// Every boundary probe targets that real intake so it exercises live validation.
function candidates(ctx, findings, extra = {}) {
  return api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { resultKind: 'search_candidates', leaseId: ctx.leaseId, findings, ...extra },
  });
}

async function missionById(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, '/api/agent-missions');
  return (response.body?.missions ?? []).find((item) => item.id === ctx.missionId);
}

export async function checkConsentRequired(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/goals/${encodeURIComponent(ctx.goalId)}/missions`, {
    method: 'POST',
    origin: ACCEPTANCE_ORIGIN,
    body: { agent: 'hermes', cadence: 'manual' },
  });
  return {
    id: 'A1',
    name: 'Mission without explicit confirmation is rejected',
    passed: response.status === 400,
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkLegacyFindingsRefused(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { leaseId: ctx.leaseId, findings: [finding('https://example.com/legacy-findings-probe')] },
  });
  return {
    id: 'A10',
    name: 'Agent findings are never admitted as Evidence (Completado requires Kernel SUPPORT)',
    passed: response.status === 409 && response.body?.code === 'AGENT_FINDINGS_NOT_EVIDENCE',
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkHostileUrlsRejected(ctx) {
  const rejected = [];
  const accepted = [];
  for (const url of HOSTILE_URLS) {
    const response = await candidates(ctx, [finding(url)]);
    (response.status === 400 ? rejected : accepted).push(`${url} -> ${response.status}`);
  }
  return {
    id: 'A2',
    name: 'Private, loopback, credential-bearing and sensitive URLs are rejected at candidate intake',
    passed: accepted.length === 0,
    detail: `rejected=${rejected.length}/${HOSTILE_URLS.length}${accepted.length ? ` accepted=${JSON.stringify(accepted)}` : ''}`,
  };
}

export async function checkAuthorityFieldsIgnored(ctx) {
  const response = await candidates(ctx, [finding('https://example.com/authority-probe')], {
    status: 'completed',
    executionPhase: 'forged',
    resultSummary: { received: 999, evidenceCreated: 999, opportunitiesPromoted: 999 },
  });
  const mission = response.body?.mission;
  const summary = mission?.resultSummary;
  const kernelOwned = mission?.status === 'running'
    && mission?.executionPhase === 'verifying'
    && summary?.received === 1
    && summary?.evidenceCreated === 0
    && summary?.opportunitiesPromoted === 0;
  return {
    id: 'A3',
    name: 'Agent-supplied authority fields are ignored; Kernel recomputes state and summary',
    passed: response.status === 202 && kernelOwned,
    detail: `status=${response.status} missionStatus=${mission?.status ?? 'none'} phase=${mission?.executionPhase ?? 'none'} summary=${JSON.stringify(summary ?? null)}`,
  };
}

export async function checkInvalidLeaseRejected(ctx) {
  const response = await candidates({ ...ctx, leaseId: '00000000-0000-4000-8000-000000000000' }, [finding('https://example.com/stale-lease')]);
  return {
    id: 'A4',
    name: 'Stale or forged lease cannot admit candidates',
    passed: response.status === 409 && response.body?.code === 'AGENT_MISSION_LEASE_INVALID',
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkOversizedPayloadRejected(ctx) {
  const findings = Array.from({ length: 21 }, (_, index) => finding(`https://example.com/overflow-${index}`));
  const response = await candidates(ctx, findings);
  return {
    id: 'A5',
    name: 'Oversized candidate batches are rejected before persistence',
    passed: response.status === 400,
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkUnauthenticatedAccessRejected(ctx) {
  const response = await fetch(`${ctx.baseUrl}/api/agent-missions`, { headers: { 'x-hephaestus-token': 'invalid-token-value' } });
  return {
    id: 'A6',
    name: 'Kernel API rejects an invalid token',
    passed: response.status === 401 || response.status === 403,
    detail: `status=${response.status}`,
  };
}

export async function checkDeduplication(ctx) {
  const url = 'https://example.com/duplicate-acceptance-probe';
  const response = await candidates(ctx, [finding(url), finding(url)]);
  const mission = response.body?.mission;
  const persisted = Array.isArray(mission?.searchCandidates) ? mission.searchCandidates.length : -1;
  return {
    id: 'A7',
    name: 'Duplicate candidates are persisted once and never count as Evidence',
    passed: response.status === 202 && persisted === 1 && mission?.resultSummary?.evidenceCreated === 0,
    detail: `status=${response.status} persistedCandidates=${persisted} summary=${JSON.stringify(mission?.resultSummary ?? null)}`,
  };
}

export async function checkTerminalStateOwnedByKernel(ctx) {
  const mission = await missionById(ctx);
  const kernelOwned = mission?.status === 'running' && mission?.executionPhase === 'verifying';
  return {
    id: 'A8',
    name: 'Kernel owns the post-intake state (verifying, not Completado) and clears the lease',
    passed: Boolean(kernelOwned) && mission?.leaseId === undefined && mission?.leaseExpiresAt === undefined,
    detail: `status=${mission?.status ?? 'none'} phase=${mission?.executionPhase ?? 'none'} leaseCleared=${mission?.leaseId === undefined}`,
  };
}

export async function checkReplayIdempotentAfterCompletion(ctx) {
  const before = await missionById(ctx);
  const duplicateUrl = 'https://example.com/duplicate-acceptance-probe';
  const response = await candidates(ctx, [finding(duplicateUrl), finding(duplicateUrl)]);
  const after = await missionById(ctx);
  const beforeExecution = missionExecutionSnapshot(before);
  const afterExecution = missionExecutionSnapshot(after);
  const executionUnchanged = JSON.stringify(afterExecution) === JSON.stringify(beforeExecution);
  return {
    id: 'A9',
    name: 'Exact candidate retry is idempotent and does not reopen or duplicate the mission',
    passed: response.status === 202
      && response.body?.idempotent === true
      && executionUnchanged
      && after?.searchCandidates?.length === 1
      && after?.resultSummary?.evidenceCreated === 0,
    detail: `status=${response.status} idempotent=${response.body?.idempotent === true} executionUnchanged=${executionUnchanged} candidates=${after?.searchCandidates?.length ?? 'none'}`,
  };
}

function missionExecutionSnapshot(mission) {
  return {
    status: mission?.status,
    executionPhase: mission?.executionPhase,
    attempt: mission?.attempt,
    completedAt: mission?.completedAt,
    forgedAt: mission?.forgedAt,
    resultSummary: mission?.resultSummary,
    searchCandidateDigest: mission?.searchCandidateDigest,
    leaseClosed: mission?.leaseId === undefined && mission?.leaseExpiresAt === undefined,
  };
}
