import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { InboxError } from './page-context-inbox.mjs';

export class ObsidianKnowledgeProjector {
  constructor(store, vaultPath) {
    this.store = store;
    this.vaultPath = vaultPath;
  }

  async syncCase(caseId) {
    const data = await this.store.read();
    const caseRecord = data.cases.find((item) => item.id === caseId);
    if (!caseRecord) throw new InboxError('CASE_NOT_FOUND', `Case not found: ${caseId}`, 404);
    const evidence = data.evidence.filter((item) => item.caseId === caseId);
    const caseFile = `${safeId(caseId)}.md`;

    await Promise.all([
      atomicNote(join(this.vaultPath, 'Cases', caseFile), renderCase(caseRecord, evidence)),
      atomicNote(join(this.vaultPath, 'Reports', caseFile), renderReport(caseRecord, evidence)),
      ...evidence.map((item) => atomicNote(
        join(this.vaultPath, 'Evidence', `${safeId(item.id)}.md`),
        renderEvidence(item, caseRecord),
      )),
    ]);

    return {
      caseNote: `Cases/${caseFile}`,
      reportNote: `Reports/${caseFile}`,
      evidenceNotes: evidence.map((item) => `Evidence/${safeId(item.id)}.md`),
    };
  }
}

function renderCase(record, evidence) {
  return [
    '---',
    `id: ${yaml(record.id)}`,
    'type: case',
    `status: ${yaml(record.status)}`,
    `created_at: ${yaml(record.createdAt)}`,
    `updated_at: ${yaml(record.updatedAt)}`,
    '---',
    '',
    `# ${record.title}`,
    '',
    '## Objective',
    '',
    record.objective,
    '',
    '## Evidence',
    '',
    ...(evidence.length
      ? evidence.map((item) => `- [[Evidence/${safeId(item.id)}|${item.summary ?? item.id}]]`)
      : ['No Evidence captured yet.']),
    '',
    '## Report',
    '',
    `- [[Reports/${safeId(record.id)}|Evidence report]]`,
    '',
  ].join('\n');
}

function renderEvidence(item, caseRecord) {
  return [
    '---',
    `id: ${yaml(item.id)}`,
    'type: evidence',
    `case_id: ${yaml(item.caseId)}`,
    `captured_at: ${yaml(item.capturedAt)}`,
    `confidence: ${Number(item.confidence ?? 0)}`,
    `source_receipt_id: ${yaml(item.sourceReceiptId)}`,
    `content_hash: ${yaml(item.contentHash)}`,
    '---',
    '',
    `# Evidence — ${item.summary ?? item.id}`,
    '',
    `**Case:** [[Cases/${safeId(caseRecord.id)}|${caseRecord.title}]]`,
    item.sourceUrl ? `**Source:** ${item.sourceUrl}` : '',
    `**Extraction:** ${item.extractionMethod ?? 'unknown'}`,
    '',
    '## Summary',
    '',
    item.summary ?? 'No summary available.',
    '',
    '## Raw captured text',
    '',
    item.rawText ?? 'No raw text available.',
    '',
  ].filter((line) => line !== '').join('\n\n');
}

function renderReport(caseRecord, evidence) {
  const average = evidence.length
    ? evidence.reduce((sum, item) => sum + Number(item.confidence ?? 0), 0) / evidence.length
    : 0;
  return [
    '---',
    `case_id: ${yaml(caseRecord.id)}`,
    'type: evidence-report',
    `generated_at: ${yaml(new Date().toISOString())}`,
    `confidence: ${average.toFixed(3)}`,
    '---',
    '',
    `# ${caseRecord.title} — Evidence Report`,
    '',
    '## Objective',
    '',
    caseRecord.objective,
    '',
    '## Collected Evidence',
    '',
    ...(evidence.length
      ? evidence.map((item) => `- [[Evidence/${safeId(item.id)}|${item.summary ?? item.id}]] — confidence ${item.confidence}`)
      : ['No Evidence captured yet.']),
    '',
    '## Limitations',
    '',
    '- This report only reflects Evidence currently attached to the Case.',
    '- Captured page text may be incomplete or change after capture.',
    '- Absence of Evidence is not Evidence of absence.',
    '',
    '## Next Actions',
    '',
    '- Review primary sources and verify high-impact claims.',
    '- Capture additional independent Evidence before deciding.',
    '',
  ].join('\n');
}

async function atomicNote(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${content}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, path);
}

function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 180);
}

function yaml(value) {
  return JSON.stringify(value ?? null);
}
