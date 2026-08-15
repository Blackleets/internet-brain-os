export const GITHUB_READONLY_SCHEMA_VERSION = 'efesto.github-readonly.v1' as const;

export const GITHUB_READ_CAPABILITIES = Object.freeze([
  'github.repository.read',
  'github.issue.read',
  'github.pull_request.read',
  'github.checks.read',
] as const);

export const GITHUB_READ_OPERATIONS = Object.freeze([
  'repository',
  'issues',
  'pull_requests',
  'checks',
] as const);

export type GitHubReadCapability = (typeof GITHUB_READ_CAPABILITIES)[number];
export type GitHubReadOperation = (typeof GITHUB_READ_OPERATIONS)[number];

export interface GitHubReadInput {
  readonly operation: GitHubReadOperation;
  readonly owner: string;
  readonly repo: string;
  readonly ref?: string;
  readonly limit?: number;
}

export interface GitHubReadResponse {
  readonly schemaVersion: typeof GITHUB_READONLY_SCHEMA_VERSION;
  readonly operation: GitHubReadOperation;
  readonly resource: {
    readonly owner: string;
    readonly repo: string;
    readonly ref?: string;
    readonly limit?: number;
  };
  readonly provider: 'github-api';
  readonly fetchedAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export class GitHubReadOnlyError extends Error {
  constructor(
    readonly code: 'GITHUB_CREDENTIAL_INVALID' | 'GITHUB_TIMEOUT' | 'GITHUB_UNAUTHORIZED' | 'GITHUB_FORBIDDEN' | 'GITHUB_NOT_FOUND' | 'GITHUB_RATE_LIMITED' | 'GITHUB_RESPONSE_INVALID' | 'GITHUB_PROVIDER_FAILED' | 'GITHUB_INPUT_INVALID',
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'GitHubReadOnlyError';
  }
}

export interface GitHubReadOnlyClientOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
  readonly userAgent?: string;
  readonly baseUrl?: string;
}

/**
 * Provider adapter only. It can read bounded GitHub resources and cannot
 * create, mutate, merge, comment, dispatch, or delete anything remotely.
 */
export class GitHubReadOnlyClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly userAgent: string;
  private readonly baseUrl: string;

  constructor(options: GitHubReadOnlyClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.timeoutMs = boundedTimeout(options.timeoutMs);
    this.userAgent = cleanUserAgent(options.userAgent ?? 'InternetBrainOS-Efesto/0.1');
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? 'https://api.github.com');
  }

  async verifyToken(token: string): Promise<void> {
    const credential = validateToken(token);
    const response = await this.request('/user', credential);
    const body = readObject(response);
    if (typeof body.login !== 'string' || !body.login.trim()) {
      throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub returned an invalid identity response.');
    }
  }

  async read(input: GitHubReadInput, token: string): Promise<GitHubReadResponse> {
    const normalized = normalizeInput(input);
    const credential = validateToken(token);
    const path = pathFor(normalized);
    const body = await this.request(path, credential);
    const data = normalizeResponse(normalized.operation, body, normalized);
    return {
      schemaVersion: GITHUB_READONLY_SCHEMA_VERSION,
      operation: normalized.operation,
      resource: {
        owner: normalized.owner,
        repo: normalized.repo,
        ...(normalized.ref ? { ref: normalized.ref } : {}),
        ...(normalized.limit ? { limit: normalized.limit } : {}),
      },
      provider: 'github-api',
      fetchedAt: new Date().toISOString(),
      data,
    };
  }

  private async request(path: string, token: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: 'GET',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'user-agent': this.userAgent,
            'x-github-api-version': '2022-11-28',
          },
        });
      } catch (error) {
        if (controller.signal.aborted) throw new GitHubReadOnlyError('GITHUB_TIMEOUT', 'GitHub did not respond within the bounded read window.', 504);
        throw new GitHubReadOnlyError('GITHUB_PROVIDER_FAILED', 'GitHub could not be reached.');
      }

      if (!response.ok) throw providerError(response);
      return await readJson(response);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeInput(input: GitHubReadInput): GitHubReadInput {
  if (!input || typeof input !== 'object') throw inputError('GitHub read input must be an object.');
  const operation = cleanOperation(input.operation);
  const owner = cleanSegment(input.owner, 'owner');
  const repo = cleanSegment(input.repo, 'repo');
  const ref = input.ref === undefined ? undefined : cleanRef(input.ref);
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw inputError('GitHub read limit must be an integer between 1 and 20.');
  if (operation === 'checks' && !ref) throw inputError('GitHub checks reads require a commit, branch, or tag ref.');
  return { operation, owner, repo, ...(ref ? { ref } : {}), limit };
}

function pathFor(input: GitHubReadInput): string {
  const repository = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  switch (input.operation) {
    case 'repository': return repository;
    case 'issues': return `${repository}/issues?state=open&per_page=${input.limit ?? 20}`;
    case 'pull_requests': return `${repository}/pulls?state=open&per_page=${input.limit ?? 20}`;
    case 'checks': return `${repository}/commits/${encodeURIComponent(input.ref ?? '')}/check-runs?per_page=${input.limit ?? 20}`;
  }
}

function normalizeResponse(operation: GitHubReadOperation, body: unknown, input: GitHubReadInput): Readonly<Record<string, unknown>> {
  if (operation === 'repository') {
    const record = readObject(body);
    return {
      kind: 'repository',
      id: numberOrNull(record.id),
      fullName: stringOrNull(record.full_name),
      name: stringOrNull(record.name),
      owner: stringOrNull(readObjectOrEmpty(record.owner).login) ?? input.owner,
      private: record.private === true,
      description: stringOrNull(record.description),
      defaultBranch: stringOrNull(record.default_branch),
      htmlUrl: publicUrl(record.html_url),
      stars: numberOrNull(record.stargazers_count),
      forks: numberOrNull(record.forks_count),
      openIssues: numberOrNull(record.open_issues_count),
      updatedAt: stringOrNull(record.updated_at),
    };
  }

  if (operation === 'checks') {
    const record = readObject(body);
    const checks = Array.isArray(record.check_runs) ? record.check_runs : [];
    return {
      kind: 'checks',
      ref: input.ref,
      total: numberOrNull(record.total_count) ?? checks.length,
      items: checks.slice(0, input.limit ?? 20).map((item) => normalizeCheck(item)),
    };
  }

  if (!Array.isArray(body)) throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub returned an invalid list response.');
  const items = body
    .filter((item) => operation !== 'issues' || !readObjectOrEmpty(item).pull_request)
    .slice(0, input.limit ?? 20)
    .map((item) => normalizeIssueOrPullRequest(item, operation));
  return { kind: operation, total: items.length, items };
}

function normalizeIssueOrPullRequest(value: unknown, operation: 'issues' | 'pull_requests'): Readonly<Record<string, unknown>> {
  const record = readObject(value);
  return {
    id: numberOrNull(record.id),
    number: numberOrNull(record.number),
    title: stringOrNull(record.title),
    state: stringOrNull(record.state),
    htmlUrl: publicUrl(record.html_url),
    author: stringOrNull(readObjectOrEmpty(record.user).login),
    labels: Array.isArray(record.labels) ? record.labels.slice(0, 20).map((label) => stringOrNull(readObjectOrEmpty(label).name)).filter((label): label is string => Boolean(label)) : [],
    updatedAt: stringOrNull(record.updated_at),
    operation,
  };
}

function normalizeCheck(value: unknown): Readonly<Record<string, unknown>> {
  const record = readObject(value);
  return {
    id: numberOrNull(record.id),
    name: stringOrNull(record.name),
    status: stringOrNull(record.status),
    conclusion: stringOrNull(record.conclusion),
    htmlUrl: publicUrl(record.html_url),
    headSha: stringOrNull(record.head_sha),
    startedAt: stringOrNull(record.started_at),
    completedAt: stringOrNull(record.completed_at),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > 1024 * 1024) {
    throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub response exceeded the bounded response limit.');
  }
  const text = await response.text();
  if (text.length > 1024 * 1024) throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub response exceeded the bounded response limit.');
  try { return JSON.parse(text); }
  catch { throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub returned invalid JSON.'); }
}

function providerError(response: Response): GitHubReadOnlyError {
  if (response.status === 401) return new GitHubReadOnlyError('GITHUB_UNAUTHORIZED', 'GitHub rejected the read credential.', 401);
  if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') return new GitHubReadOnlyError('GITHUB_RATE_LIMITED', 'GitHub rate limit reached for this read connector.', 429);
  if (response.status === 403) return new GitHubReadOnlyError('GITHUB_FORBIDDEN', 'GitHub denied this read scope.', 403);
  if (response.status === 404) return new GitHubReadOnlyError('GITHUB_NOT_FOUND', 'The GitHub resource was not found or is not visible to this credential.', 404);
  return new GitHubReadOnlyError('GITHUB_PROVIDER_FAILED', `GitHub returned HTTP ${response.status}.`);
}

function readObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GitHubReadOnlyError('GITHUB_RESPONSE_INVALID', 'GitHub returned an invalid object response.');
  return value as Record<string, unknown>;
}

function readObjectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function publicUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.toString() : null;
  } catch { return null; }
}

function cleanOperation(value: unknown): GitHubReadOperation {
  if (typeof value !== 'string' || !(GITHUB_READ_OPERATIONS as readonly string[]).includes(value)) throw inputError('GitHub read operation is unsupported.');
  return value as GitHubReadOperation;
}

function cleanSegment(value: unknown, field: string): string {
  if (typeof value !== 'string') throw inputError(`GitHub ${field} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(normalized)) throw inputError(`GitHub ${field} is invalid.`);
  return normalized;
}

function cleanRef(value: unknown): string {
  if (typeof value !== 'string') throw inputError('GitHub ref is invalid.');
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/u.test(normalized) || normalized.includes('..')) throw inputError('GitHub ref is invalid.');
  return normalized;
}

function validateToken(value: unknown): string {
  if (typeof value !== 'string') throw new GitHubReadOnlyError('GITHUB_CREDENTIAL_INVALID', 'GitHub credential is invalid.', 422);
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 512 || /\s|[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new GitHubReadOnlyError('GITHUB_CREDENTIAL_INVALID', 'GitHub credential is invalid.', 422);
  }
  return normalized;
}

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') throw new Error('invalid');
    return url.href.replace(/\/$/u, '');
  } catch { throw new Error('GitHub API base URL must be https://api.github.com.'); }
}

function cleanUserAgent(value: string): string {
  const normalized = value.trim();
  return normalized && normalized.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(normalized) ? normalized : 'InternetBrainOS-Efesto/0.1';
}

function boundedTimeout(value: number | undefined): number {
  if (!Number.isFinite(value)) return 10_000;
  return Math.min(Math.max(Number(value), 1_000), 30_000);
}

function inputError(message: string): GitHubReadOnlyError {
  return new GitHubReadOnlyError('GITHUB_INPUT_INVALID', message, 400);
}
