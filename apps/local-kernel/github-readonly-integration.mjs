import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  GITHUB_AUTHORIZATION_SCHEMA_VERSION,
  GITHUB_READ_CAPABILITIES,
  GITHUB_READONLY_SCHEMA_VERSION,
  GITHUB_READ_RECEIPT_SCHEMA_VERSION,
  GITHUB_READ_SCOPE,
  githubCapabilityForOperation,
} from './github-readonly-contract.mjs';

const TRUSTED_ACTOR_TYPES = new Set(['interactive_user', 'founder']);
const MAX_AUTHORIZATIONS = 100;
const MAX_READ_RECEIPTS = 250;
const DEFAULT_AUTHORIZATION_TTL_MS = 15 * 60 * 1000;

export class GitHubIntegrationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'GitHubIntegrationError';
    this.code = code;
    this.status = status;
  }
}

/** Owner-private, server-side GitHub credential storage. */
export class GitHubCredentialStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.environmentToken = validCredential(options.envToken) ? options.envToken.trim() : undefined;
    this.environmentTokenInvalid = options.envToken !== undefined && !this.environmentToken;
  }

  async getToken() {
    if (this.environmentToken) return this.environmentToken;
    try {
      const parsed = JSON.parse(await readPrivateCredentialFile(this.filePath));
      if (!validCredential(parsed?.token)) throw new Error('invalid credential');
      return parsed.token.trim();
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined;
      if (error instanceof GitHubIntegrationError) throw error;
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_STORE_INVALID', 'The local GitHub credential store is invalid.', 500);
    }
  }

  async status() {
    if (this.environmentTokenInvalid) return { status: 'degraded', configured: false, managedBy: 'environment', source: 'environment' };
    if (this.environmentToken) return { status: 'ready', configured: true, managedBy: 'environment', source: 'environment' };
    try {
      const token = await this.getToken();
      return token
        ? { status: 'ready', configured: true, managedBy: 'local', source: 'local' }
        : { status: 'not_configured', configured: false, managedBy: null, source: null };
    } catch {
      return { status: 'degraded', configured: false, managedBy: 'local', source: 'local' };
    }
  }

  async save(token) {
    if (this.environmentToken || this.environmentTokenInvalid) {
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_ENV_MANAGED', 'Environment-managed GitHub credentials cannot be changed from the dashboard.', 409);
    }
    const normalized = requireCredential(token);
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
    const temporary = `${this.filePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ schemaVersion: GITHUB_READONLY_SCHEMA_VERSION, token: normalized })}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await chmod(temporary, 0o600);
    await rename(temporary, this.filePath);
    await chmod(this.filePath, 0o600);
  }

  async clear() {
    if (this.environmentToken || this.environmentTokenInvalid) {
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_ENV_MANAGED', 'Environment-managed GitHub credentials cannot be removed from the dashboard.', 409);
    }
    try { await unlink(this.filePath); }
    catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
}

/**
 * Kernel-local authority boundary for the first real external connector.
 * The provider client is injected so this layer owns consent, scopes,
 * revocation, idempotency and provenance without coupling the Kernel to HTTP.
 */
export class GitHubReadOnlyIntegration {
  constructor({ store, credentials, reader, now = () => new Date(), authorizationTtlMs = DEFAULT_AUTHORIZATION_TTL_MS } = {}) {
    if (!store || typeof store.read !== 'function' || typeof store.project !== 'function') throw new Error('GitHub integration requires a knowledge store.');
    if (!credentials || typeof credentials.getToken !== 'function') throw new Error('GitHub integration requires a credential store.');
    if (!reader || typeof reader.read !== 'function' || typeof reader.verifyToken !== 'function') throw new Error('GitHub integration requires a provider reader.');
    this.store = store;
    this.credentials = credentials;
    this.reader = reader;
    this.now = now;
    this.authorizationTtlMs = boundedTtl(authorizationTtlMs);
    this.health = undefined;
    this.readQueue = Promise.resolve();
  }

  async status() {
    const credential = await this.credentials.status();
    const status = this.health === 'degraded' && credential.status === 'ready' ? 'degraded' : credential.status;
    return {
      schemaVersion: GITHUB_READONLY_SCHEMA_VERSION,
      id: 'github',
      adapter: 'native',
      status,
      configured: credential.configured,
      managedBy: credential.managedBy,
      source: credential.source,
      scopes: [GITHUB_READ_SCOPE],
      capabilities: status === 'ready' ? [...GITHUB_READ_CAPABILITIES] : [],
      requiresExplicitConsent: true,
      authorizationTtlSeconds: Math.floor(this.authorizationTtlMs / 1000),
    };
  }

  async configureCredential(token) {
    const normalized = requireCredential(token);
    try {
      await this.reader.verifyToken(normalized);
    } catch {
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_REJECTED', 'GitHub rejected this read credential. Nothing was saved.', 422);
    }
    const previous = await this.credentials.getToken();
    await this.credentials.save(normalized);
    if (previous && previous !== normalized) await this.#revokeAll('credential_replaced');
    this.health = 'ready';
    return this.status();
  }

  async revokeCredential() {
    await this.credentials.clear();
    await this.#revokeAll('credential_revoked');
    this.health = undefined;
    return this.status();
  }

  async authorize({ goalId, capabilities, resource, actor } = {}) {
    const configured = await this.status();
    if (configured.status !== 'ready') throw new GitHubIntegrationError('GITHUB_NOT_CONFIGURED', 'Configure and verify GitHub before authorizing a read scope.', 409);
    const normalizedGoalId = cleanText(goalId, 'goalId', 240);
    const approvedCapabilities = normalizeCapabilities(capabilities);
    const normalizedResource = normalizeResource(resource);
    if (approvedCapabilities.includes('github.checks.read') && !normalizedResource.ref) {
      throw new GitHubIntegrationError('GITHUB_RESOURCE_INVALID', 'GitHub checks authorization requires an explicit commit, branch, or tag ref.', 400);
    }
    const trustedActor = normalizeActor(actor);
    const data = await this.store.read();
    const goal = (data.goals ?? []).find((item) => item?.id === normalizedGoalId && item?.status === 'active');
    if (!goal) throw new GitHubIntegrationError('GITHUB_GOAL_NOT_FOUND', 'An active Goal is required before authorizing GitHub.', 404);
    const token = await this.credentials.getToken();
    if (!token) throw new GitHubIntegrationError('GITHUB_NOT_CONFIGURED', 'Configure GitHub before authorizing a read scope.', 409);

    const issuedAt = this.now().toISOString();
    const expiresAt = new Date(new Date(issuedAt).getTime() + this.authorizationTtlMs).toISOString();
    const canonical = {
      schemaVersion: GITHUB_AUTHORIZATION_SCHEMA_VERSION,
      goalId: normalizedGoalId,
      goalRevision: currentGoalRevision(goal),
      decision: 'approved',
      scope: GITHUB_READ_SCOPE,
      approvedCapabilities,
      resource: normalizedResource,
      credentialFingerprint: credentialFingerprint(token),
      actorType: trustedActor.actorType,
      decidedBy: trustedActor.decidedBy,
      issuedAt,
      expiresAt,
    };
    const receipt = { ...canonical, id: `github-auth:${hash(canonical)}` };
    return this.store.project(async (current) => {
      const authorizations = Array.isArray(current.githubAuthorizations) ? current.githubAuthorizations : [];
      const existing = authorizations.find((item) => item?.id === receipt.id);
      if (existing) return { changed: false, data: current, result: publicAuthorization(existing) };
      const next = [...authorizations, receipt].slice(-MAX_AUTHORIZATIONS);
      return { changed: true, data: { ...current, githubAuthorizations: next }, result: publicAuthorization(receipt) };
    });
  }

  async revokeAuthorization(receiptId, actor) {
    const normalizedId = cleanText(receiptId, 'receiptId', 240);
    const trustedActor = normalizeActor(actor);
    return this.store.project(async (current) => {
      const authorizations = Array.isArray(current.githubAuthorizations) ? current.githubAuthorizations : [];
      const index = authorizations.findIndex((item) => item?.id === normalizedId);
      if (index < 0) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_NOT_FOUND', 'GitHub authorization receipt was not found.', 404);
      const existing = authorizations[index];
      if (existing.revokedAt) return { changed: false, data: current, result: publicAuthorization(existing) };
      const revoked = { ...existing, revokedAt: this.now().toISOString(), revokedBy: trustedActor.decidedBy, revokeReason: 'user_revoked' };
      const next = [...authorizations];
      next[index] = revoked;
      return { changed: true, data: { ...current, githubAuthorizations: next }, result: publicAuthorization(revoked) };
    });
  }

  async getAuthorization(receiptId) {
    const normalizedId = cleanText(receiptId, 'receiptId', 240);
    const data = await this.store.read();
    const receipt = (data.githubAuthorizations ?? []).find((item) => item?.id === normalizedId);
    if (!receipt) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_NOT_FOUND', 'GitHub authorization receipt was not found.', 404);
    return { ...publicAuthorization(receipt), status: authorizationStatus(receipt, this.now()) };
  }

  read(input = {}) {
    const task = this.readQueue.then(() => this.#read(input));
    this.readQueue = task.catch(() => undefined);
    return task;
  }

  async #read({ authorizationId, idempotencyKey, operation, owner, repo, ref, limit } = {}) {
    const normalizedAuthorizationId = cleanText(authorizationId, 'authorizationId', 240);
    const normalizedIdempotencyKey = cleanText(idempotencyKey, 'idempotencyKey', 240);
    const request = normalizeReadRequest({ operation, owner, repo, ...(ref === undefined ? {} : { ref }), ...(limit === undefined ? {} : { limit }) });
    const capability = githubCapabilityForOperation(request.operation);
    if (!capability) throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub read operation is unsupported.', 400);
    const data = await this.store.read();
    const authorization = (data.githubAuthorizations ?? []).find((item) => item?.id === normalizedAuthorizationId);
    assertActiveAuthorization(authorization, capability, this.now());
    assertActiveGoal(data, authorization);
    assertAuthorizedResource(authorization, request);
    const token = await this.credentials.getToken();
    if (!token) throw new GitHubIntegrationError('GITHUB_NOT_CONFIGURED', 'Configure GitHub before reading it.', 409);
    if (authorization.credentialFingerprint !== credentialFingerprint(token)) {
      await this.#revokeAll('credential_changed');
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_CHANGED', 'The GitHub credential changed; authorize the read again.', 403);
    }

    const requestFingerprint = hash(request);
    const previous = allReadReceipts(data).find((item) => item?.authorizationId === normalizedAuthorizationId && item?.idempotencyKey === normalizedIdempotencyKey);
    if (previous) {
      if (readRequestFingerprint(previous) !== requestFingerprint) {
        throw new GitHubIntegrationError('GITHUB_IDEMPOTENCY_REUSE', 'The GitHub idempotency key was reused with a different request.', 409);
      }
      return { receipt: publicReadReceipt(previous), result: structuredClone(previous.result), replayed: true };
    }
    const receiptId = `github-read:${hash({ authorizationId: normalizedAuthorizationId, idempotencyKey: normalizedIdempotencyKey, request })}`;

    let response;
    try {
      response = await this.reader.read(request, token);
      this.health = 'ready';
    } catch (error) {
      if (error?.code === 'GITHUB_UNAUTHORIZED' || error?.code === 'GITHUB_FORBIDDEN') this.health = 'degraded';
      throw mapProviderError(error);
    }
    assertReaderResponse(response, request);
    const result = structuredClone(response.data);
    const receipt = {
      schemaVersion: GITHUB_READ_RECEIPT_SCHEMA_VERSION,
      id: receiptId,
      authorizationId: normalizedAuthorizationId,
      idempotencyKey: normalizedIdempotencyKey,
      requestFingerprint,
      goalId: authorization.goalId,
      capability,
      scope: GITHUB_READ_SCOPE,
      operation: response.operation,
      resource: response.resource,
      provider: response.provider,
      fetchedAt: response.fetchedAt,
      sourceUrl: `https://github.com/${response.resource.owner}/${response.resource.repo}`,
      contentHash: hash(result),
      result,
    };
    const persistence = await this.store.project(async (current) => {
      const liveAuthorization = (current.githubAuthorizations ?? []).find((item) => item?.id === normalizedAuthorizationId);
      assertActiveAuthorization(liveAuthorization, capability, this.now());
      assertActiveGoal(current, liveAuthorization);
      assertAuthorizedResource(liveAuthorization, request);
      const currentToken = await this.credentials.getToken();
      if (!currentToken) throw new GitHubIntegrationError('GITHUB_NOT_CONFIGURED', 'Configure GitHub before reading it.', 409);
      if (liveAuthorization.credentialFingerprint !== credentialFingerprint(currentToken)) {
        return { changed: false, data: current, result: { credentialChanged: true } };
      }
      const receipts = allReadReceipts(current);
      const existing = receipts.find((item) => item?.id === receipt.id);
      if (existing) return { changed: false, data: current, result: undefined };
      const nextReceipts = [...receipts, receipt];
      const activeReceipts = nextReceipts.slice(-MAX_READ_RECEIPTS);
      const archivedReceipts = nextReceipts.slice(0, -MAX_READ_RECEIPTS);
      return {
        changed: true,
        data: {
          ...current,
          githubReadReceipts: activeReceipts,
          githubReadReceiptArchive: archivedReceipts,
        },
        result: undefined,
      };
    });
    if (persistence?.credentialChanged) {
      await this.#revokeAll('credential_changed');
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_CHANGED', 'The GitHub credential changed; authorize the read again.', 403);
    }
    return { receipt: publicReadReceipt(receipt), result, replayed: false };
  }

  async #revokeAll(reason) {
    return this.store.project(async (current) => {
      const authorizations = Array.isArray(current.githubAuthorizations) ? current.githubAuthorizations : [];
      const revokedAt = this.now().toISOString();
      let changed = false;
      const next = authorizations.map((item) => {
        if (!item?.revokedAt) {
          changed = true;
          return { ...item, revokedAt, revokedBy: 'kernel', revokeReason: reason };
        }
        return item;
      });
      return { changed, data: changed ? { ...current, githubAuthorizations: next } : current, result: undefined };
    });
  }
}

export async function createRuntimeGitHubReadOnlyIntegration({ store, dataDir, env = process.env } = {}) {
  try {
    const connectors = await import('../../packages/connectors/dist/index.js');
    const credentials = new GitHubCredentialStore(`${dataDir}/github-credential.json`, { envToken: env.HEPHAESTUS_GITHUB_TOKEN });
    const reader = new connectors.GitHubReadOnlyClient({ userAgent: 'InternetBrainOS-Efesto/0.1' });
    return new GitHubReadOnlyIntegration({ store, credentials, reader });
  } catch {
    return undefined;
  }
}

function assertActiveAuthorization(receipt, capability, now) {
  if (!receipt) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_NOT_FOUND', 'GitHub authorization receipt was not found.', 404);
  if (receipt.revokedAt) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_REVOKED', 'GitHub authorization was revoked.', 403);
  const expiresAt = Date.parse(receipt.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_INVALID', 'GitHub authorization expiry is invalid.', 403);
  if (expiresAt <= now.getTime()) throw new GitHubIntegrationError('GITHUB_AUTHORIZATION_EXPIRED', 'GitHub authorization expired and must be renewed.', 403);
  if (receipt.scope !== GITHUB_READ_SCOPE || !receipt.approvedCapabilities?.includes(capability)) {
    throw new GitHubIntegrationError('GITHUB_CAPABILITY_DENIED', 'This GitHub read is outside the approved capability receipt.', 403);
  }
}

function assertAuthorizedResource(receipt, request) {
  const resource = receipt?.resource;
  if (!resource || resource.owner !== request.owner || resource.repo !== request.repo || (resource.ref !== undefined && resource.ref !== request.ref)) {
    throw new GitHubIntegrationError('GITHUB_RESOURCE_NOT_AUTHORIZED', 'This GitHub resource is outside the approved consent receipt.', 403);
  }
}

function assertActiveGoal(data, authorization) {
  const activeGoal = (data.goals ?? []).find((item) => item?.id === authorization.goalId && item?.status === 'active');
  if (!activeGoal || currentGoalRevision(activeGoal) !== authorization.goalRevision) {
    throw new GitHubIntegrationError('GITHUB_GOAL_AUTHORIZATION_STALE', 'The Goal changed or is no longer active; authorize GitHub again.', 403);
  }
}

function assertReaderResponse(response, request) {
  if (!response || response.schemaVersion !== GITHUB_READONLY_SCHEMA_VERSION
    || response.operation !== request.operation
    || response.provider !== 'github-api'
    || !response.resource
    || response.resource.owner !== request.owner
    || response.resource.repo !== request.repo
    || typeof response.fetchedAt !== 'string'
    || !response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new GitHubIntegrationError('GITHUB_RESPONSE_INVALID', 'GitHub returned an invalid normalized read response.', 502);
  }
}

function normalizeCapabilities(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > GITHUB_READ_CAPABILITIES.length) {
    throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'At least one bounded GitHub read capability must be approved.', 400);
  }
  const normalized = [...new Set(value.map((item) => cleanText(item, 'capability', 100)))].sort();
  if (normalized.some((item) => !GITHUB_READ_CAPABILITIES.includes(item))) throw new GitHubIntegrationError('GITHUB_CAPABILITY_DENIED', 'The requested GitHub capability is not read-only.', 403);
  return normalized;
}

function normalizeActor(actor) {
  if (!actor || !TRUSTED_ACTOR_TYPES.has(actor.actorType)) throw new GitHubIntegrationError('GITHUB_ACTOR_UNTRUSTED', 'A trusted interactive actor is required.', 403);
  return { actorType: actor.actorType, decidedBy: cleanText(actor.decidedBy, 'decidedBy', 120) };
}

function currentGoalRevision(goal) {
  const revision = Number(goal?.currentRevision?.revision);
  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function publicAuthorization(receipt) {
  const { result: _result, credentialFingerprint: _credentialFingerprint, ...publicValue } = receipt;
  return structuredClone(publicValue);
}

function authorizationStatus(receipt, now) {
  if (receipt.revokedAt) return 'revoked';
  const expiresAt = Date.parse(receipt.expiresAt);
  if (!Number.isFinite(expiresAt)) return 'invalid';
  return expiresAt <= now.getTime() ? 'expired' : 'active';
}

function publicReadReceipt(receipt) {
  const { result: _result, requestFingerprint: _requestFingerprint, ...publicValue } = receipt;
  return structuredClone(publicValue);
}

function allReadReceipts(data) {
  const values = [
    ...(Array.isArray(data?.githubReadReceiptArchive) ? data.githubReadReceiptArchive : []),
    ...(Array.isArray(data?.githubReadReceipts) ? data.githubReadReceipts : []),
  ];
  const seen = new Set();
  return values.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function readRequestFingerprint(receipt) {
  if (typeof receipt?.requestFingerprint === 'string' && receipt.requestFingerprint) return receipt.requestFingerprint;
  return hash({
    operation: receipt?.operation,
    owner: receipt?.resource?.owner,
    repo: receipt?.resource?.repo,
    ...(receipt?.resource?.ref === undefined ? {} : { ref: receipt.resource.ref }),
    limit: receipt?.resource?.limit ?? 20,
  });
}

function mapProviderError(error) {
  if (error instanceof GitHubIntegrationError) return error;
  if (error?.code && String(error.code).startsWith('GITHUB_')) return new GitHubIntegrationError(error.code, safeMessage(error), Number(error.status) || 502);
  return new GitHubIntegrationError('GITHUB_PROVIDER_FAILED', 'GitHub read failed.', 502);
}

function requireCredential(value) {
  if (!validCredential(value)) throw new GitHubIntegrationError('GITHUB_CREDENTIAL_INVALID', 'GitHub credential is invalid.', 422);
  return value.trim();
}

async function readPrivateCredentialFile(filePath) {
  if (process.platform !== 'win32') {
    const mode = (await stat(filePath)).mode & 0o777;
    if ((mode & 0o077) !== 0) {
      throw new GitHubIntegrationError('GITHUB_CREDENTIAL_STORE_UNSAFE_PERMISSIONS', 'The local GitHub credential store must have private file permissions.', 500);
    }
  }
  return readFile(filePath, 'utf8');
}

function normalizeResource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new GitHubIntegrationError('GITHUB_RESOURCE_INVALID', 'A specific GitHub owner and repository are required for consent.', 400);
  }
  const resource = {
    owner: cleanSegment(value.owner, 'resource.owner'),
    repo: cleanSegment(value.repo, 'resource.repo'),
    ...(value.ref === undefined ? {} : { ref: cleanRef(value.ref) }),
  };
  return resource;
}

function normalizeReadRequest(value) {
  const operation = value?.operation;
  if (!githubCapabilityForOperation(operation)) throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub read operation is unsupported.', 400);
  const owner = cleanSegment(value.owner, 'owner');
  const repo = cleanSegment(value.repo, 'repo');
  const ref = value.ref === undefined ? undefined : cleanRef(value.ref);
  const limit = value.limit === undefined ? 20 : Number(value.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub read limit must be an integer between 1 and 20.', 400);
  if (operation === 'checks' && !ref) throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub checks reads require a commit, branch, or tag ref.', 400);
  return { operation, owner, repo, ...(ref === undefined ? {} : { ref }), limit };
}

function cleanSegment(value, field) {
  if (typeof value !== 'string') throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > 120 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(normalized)) {
    throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  }
  return normalized;
}

function cleanRef(value) {
  if (typeof value !== 'string') throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub ref is invalid.', 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/u.test(normalized) || normalized.includes('..')) {
    throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', 'GitHub ref is invalid.', 400);
  }
  return normalized;
}

function validCredential(value) {
  return typeof value === 'string' && value.trim().length >= 8 && value.trim().length <= 512 && !/\s|[\u0000-\u001f\u007f]/u.test(value);
}

function cleanText(value, field, max) {
  if (typeof value !== 'string') throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) throw new GitHubIntegrationError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  return normalized;
}

function boundedTtl(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_AUTHORIZATION_TTL_MS;
  return Math.min(Math.max(Math.floor(numeric), 60_000), 24 * 60 * 60 * 1000);
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function credentialFingerprint(token) {
  return hash({ credential: token });
}

function safeMessage(error) {
  return String(error?.message ?? 'GitHub read failed.').replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, 240);
}
