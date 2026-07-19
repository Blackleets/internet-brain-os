import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { InboxError, validatePageContext } from './page-context-inbox.mjs';

export class LocalKnowledgeStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.writeQueue = Promise.resolve();
  }

  async project(mutator) {
    let result;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const current = await this.read();
      const next = await mutator(current);
      result = next.result;
      if (next.changed) await this.write(next.data);
    });
    await this.writeQueue;
    return result;
  }

  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      return {
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      };
    } catch (error) {
      if (error?.code === 'ENOENT') return { cases: [], evidence: [] };
      if (error instanceof SyntaxError) throw new InboxError('CORRUPT_KNOWLEDGE_STORE', 'Local knowledge store contains invalid JSON', 500);
      throw error;
    }
  }

  async write(data) {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.filePath);
  }
}

export class CaptureCaseEvidenceProjector {
  constructor(store) {
    this.store = store;
  }

  project(receiptId, input) {
    const context = validatePageContext(input);
    const suffix = receiptId.replace(/^receipt:/, '');
    const caseId = context.targetCaseId ?? `case:${suffix}`;
    const evidenceId = `evidence:${suffix}`;

    return this.store.project(async (data) => {
      const existing = data.evidence.find((item) => item.sourceReceiptId === receiptId);
      if (existing) {
        return {
          changed: false,
          data,
          result: { caseId: existing.caseId, evidenceId: existing.id, duplicate: true },
        };
      }

      const sourceUrl = context.canonicalUrl ?? context.url;
      const targetCase = context.targetCaseId
        ? data.cases.find((item) => item.id === context.targetCaseId)
        : undefined;
      if (context.targetCaseId && !targetCase) {
        throw new InboxError('CASE_NOT_FOUND', `Case not found: ${context.targetCaseId}`, 404);
      }
      if (targetCase?.status === 'archived') {
        throw new InboxError('CASE_ARCHIVED', 'Archived Cases cannot accept new Evidence', 409);
      }
      const caseRecord = {
        id: caseId,
        title: context.title,
        objective: `Understand and verify the captured public page: ${context.title}`,
        description: context.description,
        status: 'draft',
        tags: ['browser-capture'],
        createdAt: context.capturedAt,
        updatedAt: context.capturedAt,
      };
      const evidenceRecord = {
        id: evidenceId,
        caseId,
        sourceReceiptId: receiptId,
        sourceUrl,
        contentType: 'webpage',
        mimeType: 'text/html',
        contentHash: createHash('sha256').update(context.visibleText).digest('hex'),
        rawText: context.visibleText,
        summary: context.selection ?? context.description ?? context.title,
        capturedAt: context.capturedAt,
        extractionMethod: 'browser-visible-text-v1',
        confidence: 0.5,
        tags: ['browser-capture'],
        entityIds: [],
        relationshipIds: [],
      };

      return {
        changed: true,
        data: {
          cases: context.targetCaseId ? data.cases : [...data.cases, caseRecord],
          evidence: [...data.evidence, evidenceRecord],
        },
        result: { caseId, evidenceId, duplicate: false },
      };
    });
  }

  async listCases() {
    const data = await this.store.read();
    return data.cases
      .filter((item) => item?.status !== 'archived' && typeof item?.id === 'string')
      .map((item) => ({ id: item.id, title: item.title ?? item.objective ?? item.id, status: item.status ?? 'draft' }));
  }
}
