import { createHash } from 'node:crypto';
import { GITHUB_EVIDENCE_SCHEMA_VERSION, GITHUB_READ_SCOPE } from './github-readonly-contract.mjs';

const MAX_RAW_TEXT_BYTES = 128 * 1024;

export class GitHubEvidenceProjectorError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'GitHubEvidenceProjectorError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Turns a verified, Kernel-owned GitHub read receipt into the existing
 * Case/Evidence memory shape. The receipt is the authority boundary: this
 * projector never accepts provider URLs or credentials from the browser.
 */
export class GitHubEvidenceProjector {
  constructor(store, { now = () => new Date() } = {}) {
    if (!store || typeof store.read !== 'function' || typeof store.project !== 'function') {
      throw new Error('GitHub Evidence projector requires a knowledge store.');
    }
    this.store = store;
    this.now = now;
  }

  async project({ goalId, receipt, result } = {}) {
    const normalizedGoalId = cleanText(goalId, 'goalId', 240);
    validateReceipt(receipt, normalizedGoalId);
    const normalizedResult = validateResult(result);
    const evidenceId = `evidence:github:${hash(receipt.id)}`;
    const caseId = `case:github:${hash(`${normalizedGoalId}:${receipt.sourceUrl}`)}`;
    const rawText = serializeEvidence(receipt, normalizedResult);
    const summary = summaryFor(receipt, normalizedResult);
    const capturedAt = validTimestamp(receipt.fetchedAt) ? receipt.fetchedAt : this.now().toISOString();

    return this.store.project(async (data) => {
      const goals = Array.isArray(data.goals) ? data.goals : [];
      const goal = goals.find((item) => item?.id === normalizedGoalId && item?.status === 'active');
      if (!goal) throw new GitHubEvidenceProjectorError('GITHUB_GOAL_NOT_FOUND', 'An active Goal is required before projecting GitHub Evidence.', 404);

      const evidence = Array.isArray(data.evidence) ? data.evidence : [];
      const existing = evidence.find((item) => item?.id === evidenceId || item?.sourceReceiptId === receipt.id);
      if (existing) {
        if (existing.goalId && existing.goalId !== normalizedGoalId) {
          throw new GitHubEvidenceProjectorError('GITHUB_EVIDENCE_CONFLICT', 'The GitHub receipt is already attached to another Goal.', 409);
        }
        return {
          changed: false,
          data,
          result: {
            schemaVersion: GITHUB_EVIDENCE_SCHEMA_VERSION,
            caseId: existing.caseId,
            evidenceId: existing.id,
            receiptId: receipt.id,
            goalId: normalizedGoalId,
            sourceUrl: existing.sourceUrl ?? receipt.sourceUrl,
            duplicate: true,
          },
        };
      }

      const cases = Array.isArray(data.cases) ? data.cases : [];
      const existingCase = cases.find((item) => item?.id === caseId);
      if (existingCase?.status === 'archived') {
        throw new GitHubEvidenceProjectorError('CASE_ARCHIVED', 'Archived Cases cannot accept new GitHub Evidence.', 409);
      }
      const caseRecord = {
        id: caseId,
        title: `GitHub · ${receipt.resource.owner}/${receipt.resource.repo}`,
        objective: `Inspect verified, read-only GitHub data for Goal ${normalizedGoalId}.`,
        description: 'Kernel-projected GitHub Evidence. Provider writes and automatic actions are not enabled.',
        status: 'draft',
        tags: ['github', 'read-only'],
        createdAt: capturedAt,
        updatedAt: capturedAt,
      };
      const evidenceRecord = {
        id: evidenceId,
        caseId,
        sourceReceiptId: receipt.id,
        sourceUrl: receipt.sourceUrl,
        contentType: 'github',
        mimeType: 'application/json',
        contentHash: receipt.contentHash,
        rawText,
        summary,
        capturedAt,
        extractionMethod: 'github-readonly-v1',
        confidence: 1,
        tags: ['github', 'read-only', receipt.operation],
        entityIds: [],
        relationshipIds: [],
        integration: 'github',
        goalId: normalizedGoalId,
        authorizationId: receipt.authorizationId,
        provider: receipt.provider,
        operation: receipt.operation,
        scope: GITHUB_READ_SCOPE,
      };

      return {
        changed: true,
        data: {
          ...data,
          cases: existingCase ? cases : [...cases, caseRecord],
          evidence: [...evidence, evidenceRecord],
        },
        result: {
          schemaVersion: GITHUB_EVIDENCE_SCHEMA_VERSION,
          caseId,
          evidenceId,
          receiptId: receipt.id,
          goalId: normalizedGoalId,
          sourceUrl: receipt.sourceUrl,
          duplicate: false,
        },
      };
    });
  }
}

function validateReceipt(receipt, goalId) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new GitHubEvidenceProjectorError('GITHUB_RECEIPT_INVALID', 'A verified GitHub read receipt is required.', 400);
  }
  const requiredStrings = ['id', 'authorizationId', 'goalId', 'operation', 'provider', 'fetchedAt', 'sourceUrl', 'contentHash'];
  for (const field of requiredStrings) cleanText(receipt[field], field, 512);
  if (receipt.goalId !== goalId) throw new GitHubEvidenceProjectorError('GITHUB_GOAL_MISMATCH', 'The GitHub receipt does not belong to this Goal.', 403);
  if (receipt.scope !== GITHUB_READ_SCOPE) throw new GitHubEvidenceProjectorError('GITHUB_SCOPE_INVALID', 'Only the GitHub read scope can become Evidence.', 403);
  if (!['repository', 'issues', 'pull_requests', 'checks'].includes(receipt.operation)) {
    throw new GitHubEvidenceProjectorError('GITHUB_OPERATION_INVALID', 'The GitHub operation is not supported for Evidence.', 400);
  }
  if (receipt.provider !== 'github-api' || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(receipt.sourceUrl)) {
    throw new GitHubEvidenceProjectorError('GITHUB_SOURCE_INVALID', 'The GitHub source is not an allowed canonical repository URL.', 400);
  }
  if (!receipt.resource || typeof receipt.resource !== 'object' || Array.isArray(receipt.resource)) {
    throw new GitHubEvidenceProjectorError('GITHUB_RESOURCE_INVALID', 'The GitHub receipt resource is invalid.', 400);
  }
  cleanText(receipt.resource.owner, 'resource.owner', 120);
  cleanText(receipt.resource.repo, 'resource.repo', 120);
  const expectedSource = `https://github.com/${receipt.resource.owner}/${receipt.resource.repo}`;
  if (receipt.sourceUrl !== expectedSource) throw new GitHubEvidenceProjectorError('GITHUB_SOURCE_INVALID', 'The GitHub receipt source does not match its resource.', 400);
}

function validateResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new GitHubEvidenceProjectorError('GITHUB_RESULT_INVALID', 'The normalized GitHub read result is invalid.', 400);
  }
  return structuredClone(result);
}

function serializeEvidence(receipt, result) {
  const rawText = JSON.stringify({
    schemaVersion: GITHUB_EVIDENCE_SCHEMA_VERSION,
    receiptId: receipt.id,
    operation: receipt.operation,
    resource: receipt.resource,
    data: result,
  });
  if (Buffer.byteLength(rawText, 'utf8') > MAX_RAW_TEXT_BYTES) {
    throw new GitHubEvidenceProjectorError('GITHUB_EVIDENCE_TOO_LARGE', 'The normalized GitHub result exceeds the Evidence limit.', 413);
  }
  return rawText;
}

function summaryFor(receipt, result) {
  const resource = `${receipt.resource.owner}/${receipt.resource.repo}`;
  if (receipt.operation === 'repository') return `GitHub repository read · ${resource}`;
  const count = Array.isArray(result.items) ? result.items.length : undefined;
  const suffix = count === undefined ? '' : ` · ${count} item${count === 1 ? '' : 's'}`;
  return `GitHub ${receipt.operation.replace('_', ' ')} read · ${resource}${suffix}`;
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function cleanText(value, field, max) {
  if (typeof value !== 'string') throw new GitHubEvidenceProjectorError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  const normalized = value.trim();
  if (!normalized || normalized.length > max || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new GitHubEvidenceProjectorError('GITHUB_INPUT_INVALID', `${field} is invalid.`, 400);
  }
  return normalized;
}

function hash(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}
