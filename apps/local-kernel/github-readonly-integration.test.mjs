import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import {
  GitHubCredentialStore,
  GitHubReadOnlyIntegration,
} from './github-readonly-integration.mjs';

const TOKEN = 'github-test-token-123';
const ACTOR = { actorType: 'interactive_user', decidedBy: 'dashboard-ui' };

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'efesto-github-readonly-'));
  const store = new LocalKnowledgeStore(join(dir, 'store.json'));
  await store.write({
    goals: [{
      id: 'goal:github-audit',
      status: 'active',
      title: 'Audit Efesto GitHub repository',
      objective: 'Review the repository health',
      currentRevision: { revision: 3 },
    }],
  });
  let now = new Date('2026-08-14T12:00:00.000Z');
  let verifyCalls = 0;
  let readCalls = 0;
  const reader = {
    verifyToken: async (token) => {
      verifyCalls += 1;
      if (token === 'github-invalid-token') throw new Error('provider rejected token');
    },
    read: async (request, token) => {
      readCalls += 1;
      expect(token).toBe(TOKEN);
      return {
        schemaVersion: 'efesto.github-readonly.v1',
        operation: request.operation,
        resource: { owner: request.owner, repo: request.repo, limit: request.limit ?? 20 },
        provider: 'github-api',
        fetchedAt: now.toISOString(),
        data: { kind: request.operation, fullName: `${request.owner}/${request.repo}`, items: [] },
      };
    },
  };
  const credentials = new GitHubCredentialStore(join(dir, 'github-credential.json'));
  const integration = new GitHubReadOnlyIntegration({
    store,
    credentials,
    reader,
    now: () => new Date(now),
    authorizationTtlMs: 60_000,
  });
  return {
    dir,
    store,
    credentials,
    integration,
    advance(ms) { now = new Date(now.getTime() + ms); },
    counts: () => ({ verifyCalls, readCalls }),
  };
}

describe('GitHub read-only Kernel integration', () => {
  it('verifies and stores a server-side credential without exposing it in status', async () => {
    const { dir, credentials, integration, counts } = await fixture();

    await expect(integration.configureCredential('github-invalid-token')).rejects.toMatchObject({ code: 'GITHUB_CREDENTIAL_REJECTED', status: 422 });
    expect(counts().verifyCalls).toBe(1);
    await expect(stat(join(dir, 'github-credential.json'))).rejects.toMatchObject({ code: 'ENOENT' });

    const status = await integration.configureCredential(TOKEN);
    expect(status).toMatchObject({ id: 'github', adapter: 'native', status: 'ready', configured: true, managedBy: 'local', requiresExplicitConsent: true });
    expect(JSON.stringify(status)).not.toContain(TOKEN);
    expect((await stat(join(dir, 'github-credential.json'))).mode & 0o777).toBe(0o600);
    expect(await readFile(join(dir, 'github-credential.json'), 'utf8')).toContain(TOKEN);
    expect(await credentials.status()).toMatchObject({ status: 'ready', managedBy: 'local' });
  });

  it('creates an active Goal-bound consent receipt and is idempotent', async () => {
    const { integration } = await fixture();
    await integration.configureCredential(TOKEN);

    const first = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });
    const replay = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });

    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      schemaVersion: 'efesto.github-authorization.v1',
      goalId: 'goal:github-audit',
      goalRevision: 3,
      decision: 'approved',
      scope: 'github.read',
      approvedCapabilities: ['github.repository.read'],
      actorType: 'interactive_user',
      decidedBy: 'dashboard-ui',
    });
    expect(first).not.toHaveProperty('result');
  });

  it('reports live authorization state without exposing provider credentials', async () => {
    const fixtureValue = await fixture();
    const { integration, advance } = fixtureValue;
    await integration.configureCredential(TOKEN);
    const authorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });

    await expect(integration.getAuthorization(authorization.id)).resolves.toMatchObject({ id: authorization.id, status: 'active' });
    advance(60_001);
    await expect(integration.getAuthorization(authorization.id)).resolves.toMatchObject({ id: authorization.id, status: 'expired' });
    expect(JSON.stringify(await integration.getAuthorization(authorization.id))).not.toContain(TOKEN);
  });

  it('fails closed when an authorization expiry is malformed', async () => {
    const { integration, store } = await fixture();
    await integration.configureCredential(TOKEN);
    const authorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });
    await store.project(async (data) => ({ changed: true, data: { ...data, githubAuthorizations: data.githubAuthorizations.map((item) => item.id === authorization.id ? { ...item, expiresAt: 'not-a-date' } : item) }, result: undefined }));

    await expect(integration.getAuthorization(authorization.id)).resolves.toMatchObject({ status: 'invalid' });
    await expect(integration.read({ authorizationId: authorization.id, idempotencyKey: 'invalid-expiry', operation: 'repository', owner: 'acme', repo: 'repo' }))
      .rejects.toMatchObject({ code: 'GITHUB_AUTHORIZATION_INVALID', status: 403 });
  });

  it('requires an active Goal, trusted actor, and read-only capabilities', async () => {
    const { integration, store } = await fixture();
    await integration.configureCredential(TOKEN);

    await expect(integration.authorize({ goalId: 'goal:missing', capabilities: ['github.repository.read'], actor: ACTOR }))
      .rejects.toMatchObject({ code: 'GITHUB_GOAL_NOT_FOUND', status: 404 });
    await expect(integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.write'], actor: ACTOR }))
      .rejects.toMatchObject({ code: 'GITHUB_CAPABILITY_DENIED', status: 403 });
    await expect(integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: { actorType: 'agent', decidedBy: 'hermes' } }))
      .rejects.toMatchObject({ code: 'GITHUB_ACTOR_UNTRUSTED', status: 403 });

    const authorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });
    await store.project(async (data) => ({ changed: true, data: { ...data, goals: data.goals.map((goal) => ({ ...goal, status: 'completed' })) }, result: undefined }));
    await expect(integration.read({ authorizationId: authorization.id, idempotencyKey: 'inactive-goal', operation: 'repository', owner: 'acme', repo: 'repo' }))
      .rejects.toMatchObject({ code: 'GITHUB_GOAL_AUTHORIZATION_STALE', status: 403 });
    await expect(integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR }))
      .rejects.toMatchObject({ code: 'GITHUB_GOAL_NOT_FOUND', status: 404 });
  });

  it('reads only through an active authorization and replays an idempotent receipt', async () => {
    const { integration, store, counts } = await fixture();
    await integration.configureCredential(TOKEN);
    const authorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });

    const [first, replay] = await Promise.all([
      integration.read({
        authorizationId: authorization.id,
        idempotencyKey: 'read-repository-1',
        operation: 'repository',
        owner: 'Blackleets',
        repo: 'internet-brain-os',
      }),
      integration.read({
        authorizationId: authorization.id,
        idempotencyKey: 'read-repository-1',
        operation: 'repository',
        owner: 'Blackleets',
        repo: 'internet-brain-os',
      }),
    ]);

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.result).toEqual(first.result);
    expect(first.receipt).toMatchObject({
      schemaVersion: 'efesto.github-read-receipt.v1',
      goalId: 'goal:github-audit',
      capability: 'github.repository.read',
      scope: 'github.read',
      operation: 'repository',
      sourceUrl: 'https://github.com/Blackleets/internet-brain-os',
    });
    expect(first.receipt).not.toHaveProperty('result');
    expect(counts().readCalls).toBe(1);
    expect(JSON.stringify(await store.read())).not.toContain(TOKEN);
  });

  it('enforces revocation and expiration, then revokes all authorizations with the credential', async () => {
    const fixtureValue = await fixture();
    const { integration, store, advance } = fixtureValue;
    await integration.configureCredential(TOKEN);
    const authorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });

    advance(60_001);
    await expect(integration.read({ authorizationId: authorization.id, idempotencyKey: 'expired', operation: 'repository', owner: 'acme', repo: 'repo' }))
      .rejects.toMatchObject({ code: 'GITHUB_AUTHORIZATION_EXPIRED', status: 403 });

    const freshAuthorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });
    await integration.revokeAuthorization(freshAuthorization.id, ACTOR);
    await expect(integration.read({ authorizationId: freshAuthorization.id, idempotencyKey: 'revoked', operation: 'repository', owner: 'acme', repo: 'repo' }))
      .rejects.toMatchObject({ code: 'GITHUB_AUTHORIZATION_REVOKED', status: 403 });

    advance(-60_001);
    const activeAuthorization = await integration.authorize({ goalId: 'goal:github-audit', capabilities: ['github.repository.read'], actor: ACTOR });
    await integration.revokeCredential();
    expect(await integration.status()).toMatchObject({ status: 'not_configured', configured: false });
    const persisted = await store.read();
    expect(persisted.githubAuthorizations.filter((item) => item.id === activeAuthorization.id)[0]).toHaveProperty('revokedAt');
    await expect(integration.read({ authorizationId: activeAuthorization.id, idempotencyKey: 'after-credential-revoke', operation: 'repository', owner: 'acme', repo: 'repo' }))
      .rejects.toMatchObject({ code: 'GITHUB_AUTHORIZATION_REVOKED', status: 403 });
  });
});
