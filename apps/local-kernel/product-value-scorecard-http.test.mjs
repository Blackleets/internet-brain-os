import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalKernelServer } from './server.mjs';

const token = 'v'.repeat(64);
const servers = new Set();

function sampleProfile() {
  return {
    categories: {},
    benefitTypes: {},
    sources: {},
    eventCount: 0,
    productScorecard: {
      schemaVersion: 'efesto.product-scorecard.v1',
      sourceOfTruth: 'local_kernel',
      observedAt: '2026-08-10T16:00:00.000Z',
      privacy: { mode: 'local_only', externalTelemetry: false },
      primary: {
        goalUsefulFindRate: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'no_executed_goals', numerator: 0, denominator: 0 },
        timeToFirstUsefulFind: { status: 'not_measurable', unit: 'milliseconds', value: null, reason: 'no_useful_or_saved_find_feedback', sampleCount: 0 },
        repeatGoalUsage: { status: 'not_measurable', unit: 'ratio', value: null, reason: 'user_cohort_identity_unavailable', localExecutedGoalCount: 0, localRepeatGoalObserved: false },
      },
      drivers: {}, guardrails: {}, coverage: {},
    },
  };
}

async function start(preferences) {
  const server = createLocalKernelServer(
    { accept: vi.fn() },
    undefined,
    undefined,
    undefined,
    { apiToken: token, preferenceLearner: preferences, allowedDashboardOrigins: [] },
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.add(server);
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP test server address.');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  const closing = [...servers].map((server) => new Promise((resolve) => server.close(resolve)));
  servers.clear();
  await Promise.all(closing);
});

describe('local product scorecard HTTP transport', () => {
  it('keeps the scorecard behind the existing authenticated local preferences read', async () => {
    const profile = sampleProfile();
    const preferences = { profile: vi.fn(async () => profile) };
    const baseUrl = await start(preferences);
    const unauthorized = await fetch(`${baseUrl}/api/preferences`);
    expect(unauthorized.status).toBe(401);
    expect(preferences.profile).not.toHaveBeenCalled();

    const response = await fetch(`${baseUrl}/api/preferences`, { headers: { 'x-hephaestus-token': token } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, profile });
    expect(preferences.profile).toHaveBeenCalledTimes(1);
  });

  it('adds no new write route or telemetry transport', async () => {
    const preferences = { profile: vi.fn(async () => sampleProfile()) };
    const baseUrl = await start(preferences);
    const response = await fetch(`${baseUrl}/api/preferences`, {
      method: 'POST',
      headers: { 'x-hephaestus-token': token, 'content-type': 'application/json' },
      body: JSON.stringify({ upload: true }),
    });
    expect(response.status).toBe(404);
    expect(preferences.profile).not.toHaveBeenCalled();
  });
});
