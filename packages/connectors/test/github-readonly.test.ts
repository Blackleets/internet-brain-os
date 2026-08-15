import { describe, expect, it } from 'vitest';
import { GitHubReadOnlyClient, GitHubReadOnlyError } from '../src';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('GitHubReadOnlyClient', () => {
  it('verifies credentials and performs bounded normalized reads with GET only', async () => {
    const requests: Array<{ url: string; method: string; authorization: string | null }> = [];
    const client = new GitHubReadOnlyClient({
      fetchImpl: (async (input: URL | RequestInfo, init?: RequestInit) => {
        const request = new Request(input, init);
        requests.push({
          url: request.url,
          method: request.method,
          authorization: request.headers.get('authorization'),
        });
        if (request.url.endsWith('/user')) return jsonResponse({ login: 'efesto-founder' });
        return jsonResponse({
          id: 42,
          full_name: 'Blackleets/internet-brain-os',
          name: 'internet-brain-os',
          owner: { login: 'Blackleets' },
          private: false,
          description: 'Kernel-first intelligence OS',
          default_branch: 'main',
          html_url: 'https://github.com/Blackleets/internet-brain-os',
          stargazers_count: 7,
          forks_count: 2,
          open_issues_count: 1,
          updated_at: '2026-08-14T12:00:00Z',
        });
      }) as typeof fetch,
    });

    await client.verifyToken('github-test-token-123');
    const result = await client.read({ operation: 'repository', owner: 'Blackleets', repo: 'internet-brain-os' }, 'github-test-token-123');

    expect(result).toMatchObject({
      schemaVersion: 'efesto.github-readonly.v1',
      operation: 'repository',
      provider: 'github-api',
      resource: { owner: 'Blackleets', repo: 'internet-brain-os', limit: 20 },
      data: {
        kind: 'repository',
        fullName: 'Blackleets/internet-brain-os',
        htmlUrl: 'https://github.com/Blackleets/internet-brain-os',
      },
    });
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.method === 'GET')).toBe(true);
    expect(requests.every((request) => request.authorization === 'Bearer github-test-token-123')).toBe(true);
  });

  it('keeps pull requests out of issue reads and bounds list operations', async () => {
    let requestedUrl = '';
    const client = new GitHubReadOnlyClient({
      fetchImpl: (async (input: URL | RequestInfo) => {
        requestedUrl = String(input);
        return jsonResponse([
          { id: 1, number: 10, title: 'Issue', state: 'open', html_url: 'https://github.com/acme/repo/issues/10', user: { login: 'alice' }, labels: [], updated_at: '2026-08-14T12:00:00Z' },
          { id: 2, number: 11, title: 'Pull request', state: 'open', html_url: 'https://github.com/acme/repo/pull/11', pull_request: { url: 'https://api.github.com/repos/acme/repo/pulls/11' }, user: { login: 'bob' }, labels: [], updated_at: '2026-08-14T12:00:00Z' },
        ]);
      }) as typeof fetch,
    });

    const result = await client.read({ operation: 'issues', owner: 'acme', repo: 'repo', limit: 1 }, 'github-test-token-123');

    expect(requestedUrl).toContain('/repos/acme/repo/issues?state=open&per_page=1');
    expect(result.data).toMatchObject({ kind: 'issues', total: 1, items: [expect.objectContaining({ number: 10, operation: 'issues' })] });
  });

  it('requires a ref for checks and maps provider denial without exposing credentials', async () => {
    let calls = 0;
    const client = new GitHubReadOnlyClient({
      fetchImpl: (async () => {
        calls += 1;
        return jsonResponse({ message: 'Bad credentials' }, 401);
      }) as typeof fetch,
    });

    await expect(client.read({ operation: 'checks', owner: 'acme', repo: 'repo' }, 'github-test-token-123'))
      .rejects.toMatchObject({ code: 'GITHUB_INPUT_INVALID', status: 400 });
    await expect(client.read({ operation: 'repository', owner: 'acme', repo: 'repo' }, 'github-test-token-123'))
      .rejects.toMatchObject({ code: 'GITHUB_UNAUTHORIZED', status: 401 });
    expect(calls).toBe(1);
    try {
      await client.read({ operation: 'repository', owner: 'acme', repo: 'repo' }, 'github-test-token-123');
    } catch (error) {
      expect(error).toBeInstanceOf(GitHubReadOnlyError);
      expect(String(error)).not.toContain('github-test-token-123');
    }
  });

  it('rejects unsafe input before network access', async () => {
    let calls = 0;
    const client = new GitHubReadOnlyClient({ fetchImpl: (async () => { calls += 1; return jsonResponse({}); }) as typeof fetch });

    await expect(client.read({ operation: 'repository', owner: '../escape', repo: 'repo' }, 'github-test-token-123'))
      .rejects.toMatchObject({ code: 'GITHUB_INPUT_INVALID' });
    await expect(client.read({ operation: 'repository', owner: 'acme', repo: 'repo', limit: 21 }, 'github-test-token-123'))
      .rejects.toMatchObject({ code: 'GITHUB_INPUT_INVALID' });
    expect(calls).toBe(0);
  });
});
