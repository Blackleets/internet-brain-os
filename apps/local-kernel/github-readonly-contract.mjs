export const GITHUB_READONLY_SCHEMA_VERSION = 'efesto.github-readonly.v1';
export const GITHUB_AUTHORIZATION_SCHEMA_VERSION = 'efesto.github-authorization.v1';
export const GITHUB_READ_RECEIPT_SCHEMA_VERSION = 'efesto.github-read-receipt.v1';

export const GITHUB_READ_SCOPE = 'github.read';
export const GITHUB_READ_CAPABILITIES = Object.freeze([
  'github.repository.read',
  'github.issue.read',
  'github.pull_request.read',
  'github.checks.read',
]);

export const GITHUB_READ_OPERATIONS = Object.freeze([
  'repository',
  'issues',
  'pull_requests',
  'checks',
]);

const CAPABILITY_BY_OPERATION = Object.freeze({
  repository: 'github.repository.read',
  issues: 'github.issue.read',
  pull_requests: 'github.pull_request.read',
  checks: 'github.checks.read',
});

export function githubCapabilityForOperation(operation) {
  return CAPABILITY_BY_OPERATION[operation];
}
