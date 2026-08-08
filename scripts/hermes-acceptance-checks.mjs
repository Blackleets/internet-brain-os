import { api } from './hermes-acceptance-lib.mjs';

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

export async function checkConsentRequired(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/goals/${encodeURIComponent(ctx.goalId)}/missions`, {
    method: 'POST',
    body: { agent: 'hermes', cadence: 'manual' },
  });
  return {
    id: 'A1',
    name: 'Mission without explicit confirmation is rejected',
    passed: response.status === 400,
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkHostileUrlsRejected(ctx) {
  const rejected = [];
  const accepted = [];
  for (const url of HOSTILE_URLS) {
    const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
      method: 'POST',
      body: { leaseId: ctx.leaseId, findings: [finding(url)] },
    });
    (response.status === 400 ? rejected : accepted).push(`${url} -> ${response.status}`);
  }
  return {
    id: 'A2',
    name: 'Private, loopback, credential-bearing and sensitive URLs are rejected',
    passed: accepted.length === 0,
    detail: `rejected=${rejected.length}/${HOSTILE_URLS.length}${accepted.length ? ` accepted=${JSON.stringify(accepted)}` : ''}`,
  };
}

export async function checkAuthorityFieldsIgnored(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: {
      leaseId: ctx.leaseId,
      status: 'failed',
      executionPhase: 'rejected',
      resultSummary: { received: 999, evidenceCreated: 999, opportunitiesPromoted: 999 },
      findings: [finding('https://example.com/authority-probe')],
    },
  });
  const summary = response.body?.mission?.resultSummary;
  const kernelOwned = response.body?.mission?.status === 'completed'
    && response.body?.mission?.executionPhase === 'forged'
    && summary?.received === 1
    && summary?.evidenceCreated === 1;
  return {
    id: 'A3',
    name: 'Agent-supplied authority fields are ignored; Kernel recomputes state and summary',
    passed: response.status === 202 && kernelOwned,
    detail: `status=${response.status} missionStatus=${response.body?.mission?.status ?? 'none'} summary=${JSON.stringify(summary ?? null)}`,
  };
}

export async function checkInvalidLeaseRejected(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { leaseId: '00000000-0000-4000-8000-000000000000', findings: [finding('https://example.com/stale-lease')] },
  });
  return {
    id: 'A4',
    name: 'Stale or forged lease cannot admit findings',
    passed: response.status === 409,
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}

export async function checkOversizedPayloadRejected(ctx) {
  const findings = Array.from({ length: 21 }, (_, index) => finding(`https://example.com/overflow-${index}`));
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { leaseId: ctx.leaseId, findings },
  });
  return {
    id: 'A5',
    name: 'Oversized finding batches are rejected before persistence',
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
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { leaseId: ctx.leaseId, findings: [finding(url), finding(url)] },
  });
  const summary = response.body?.mission?.resultSummary;
  return {
    id: 'A7',
    name: 'Duplicate findings do not inflate evidenceCreated',
    passed: response.status === 202 && summary?.received === 2 && summary?.evidenceCreated === 1,
    detail: `status=${response.status} summary=${JSON.stringify(summary ?? null)}`,
  };
}

export async function checkTerminalStateOwnedByKernel(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, '/api/agent-missions');
  const mission = (response.body?.missions ?? []).find((item) => item.id === ctx.missionId);
  const terminal = mission?.status === 'completed' && mission?.executionPhase === 'forged';
  return {
    id: 'A8',
    name: 'Kernel owns the terminal mission state and clears the lease',
    passed: Boolean(terminal) && mission?.leaseId === undefined && mission?.leaseExpiresAt === undefined,
    detail: `status=${mission?.status ?? 'none'} phase=${mission?.executionPhase ?? 'none'} leaseCleared=${mission?.leaseId === undefined}`,
  };
}

export async function checkReplayRejectedAfterCompletion(ctx) {
  const response = await api(ctx.baseUrl, ctx.token, `/api/agent-missions/${encodeURIComponent(ctx.missionId)}/results`, {
    method: 'POST',
    body: { leaseId: ctx.leaseId, findings: [finding('https://example.com/replay-probe')] },
  });
  return {
    id: 'A9',
    name: 'Completed mission rejects replayed results',
    passed: response.status === 409,
    detail: `status=${response.status} code=${response.body?.code ?? 'none'}`,
  };
}
