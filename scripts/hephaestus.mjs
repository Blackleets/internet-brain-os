#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

class JsonStore {
  constructor(path) { this.path = path; }
  async read() {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8'));
      return {
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      };
    } catch (error) {
      if (error?.code === 'ENOENT') return { cases: [], evidence: [] };
      throw new CliError(`Unable to read local data: ${safeMessage(error)}`);
    }
  }
  async write(data) {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(temporary, this.path);
  }
}

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}:${randomUUID()}`;
const print = (value) => process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);

function requireValue(value, label) {
  if (!value?.trim()) throw new CliError(`Missing required ${label}`);
  return value.trim();
}

function option(args, name, required = false) {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (required && (!value || value.startsWith('--'))) throw new CliError(`Missing required option ${name}`);
  return value;
}

function requireCase(data, caseId) {
  const record = data.cases.find((item) => item.id === caseId);
  if (!record) throw new CliError(`Case not found: ${caseId}`, 3);
  return record;
}

function reportFor(caseRecord, evidence) {
  const confidence = evidence.length
    ? evidence.reduce((sum, item) => sum + Number(item.confidence ?? 0), 0) / evidence.length
    : 0;
  return {
    id: makeId('report'),
    caseId: caseRecord.id,
    title: `${caseRecord.title} — Evidence Report`,
    generatedAt: now(),
    confidence: Math.max(0, Math.min(1, confidence)),
    sections: [
      { heading: 'Objective', content: caseRecord.objective },
      {
        heading: 'Collected Evidence',
        content: evidence.length
          ? evidence.map((item) => `- **${item.id}** (${item.contentType}, confidence ${item.confidence}). ${item.summary ?? item.rawText?.slice(0, 500) ?? 'No summary.'}${item.sourceUrl ? ` Source: ${item.sourceUrl}.` : ''}`).join('\n\n')
          : 'No evidence has been collected yet.',
      },
      {
        heading: 'Recommended Next Actions',
        content: evidence.length
          ? 'Review the evidence, validate high-impact claims, and identify missing sources before deciding.'
          : 'Collect primary-source evidence before drawing conclusions.',
      },
    ],
    limitations: [
      'This report only reflects evidence currently attached to the Case.',
      'Absence of evidence is not evidence of absence.',
    ],
  };
}

function renderReport(report) {
  return [
    `# ${report.title}`,
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Confidence:** ${report.confidence}`,
    '',
    ...report.sections.flatMap((section) => [`## ${section.heading}`, section.content, '']),
    '## Limitations',
    ...report.limitations.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function safeFileName(value) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').slice(0, 160) || 'Untitled';
}

function exportBundle(caseRecord, evidence, report) {
  const caseNote = [
    `# ${caseRecord.title}`,
    '',
    '## Objective',
    caseRecord.objective,
    '',
    `**Status:** ${caseRecord.status}`,
    `**Created:** ${caseRecord.createdAt}`,
    `**Updated:** ${caseRecord.updatedAt}`,
    '',
    '## Evidence',
    ...evidence.map((item) => `- [[${item.id}]]${item.sourceUrl ? ` — ${item.sourceUrl}` : ''}`),
    '',
  ].join('\n');
  return [
    { path: `Cases/${safeFileName(caseRecord.title)}.md`, content: caseNote },
    ...evidence.map((item) => ({
      path: `Evidence/${safeFileName(item.id)}.md`,
      content: [`# Evidence ${item.id}`, '', `- **Type:** ${item.contentType}`, `- **Captured:** ${item.capturedAt}`, `- **Confidence:** ${item.confidence}`, item.sourceUrl ? `- **Source:** ${item.sourceUrl}` : '', '', '## Summary', item.summary ?? 'No summary available.', '', '## Raw Content', item.rawText ?? 'No raw content available.', ''].filter(Boolean).join('\n'),
    })),
    { path: `Reports/${safeFileName(report.title)}.md`, content: renderReport(report) },
  ];
}

async function fetchPublicPage(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new CliError('Only public HTTP(S) URLs are supported');
  const response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new CliError(`Page fetch failed with HTTP ${response.status}`);
  const body = await response.text();
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? parsed.hostname;
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { title, text: text.slice(0, 200_000), contentType: response.headers.get('content-type') ?? 'text/html' };
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const dataDir = resolve(env.HEPHAESTUS_DATA_DIR ?? join(process.cwd(), '.hephaestus'));
  const store = new JsonStore(join(dataDir, 'store.json'));
  const [domain, action, ...args] = argv;
  if (!domain || domain === 'help' || domain === '--help') return printHelp();
  const data = await store.read();

  if (domain === 'case' && action === 'create') {
    const objective = requireValue(args[0], 'objective');
    const timestamp = now();
    const record = { id: makeId('case'), title: option(args, '--title')?.trim() || objective.slice(0, 100), objective, status: 'draft', tags: [], createdAt: timestamp, updatedAt: timestamp };
    await store.write({ ...data, cases: [...data.cases, record] });
    return print(record);
  }
  if (domain === 'case' && action === 'list') return print(data.cases);
  if (domain === 'case' && action === 'show') return print(requireCase(data, requireValue(args[0], 'case ID')));

  if (domain === 'evidence' && action === 'add') {
    const caseRecord = requireCase(data, requireValue(option(args, '--case', true), 'case ID'));
    const rawText = requireValue(option(args, '--text', true), 'evidence text');
    const sourceUrl = option(args, '--url');
    if (sourceUrl) new URL(sourceUrl);
    const record = { id: makeId('evidence'), caseId: caseRecord.id, sourceUrl, contentType: sourceUrl ? 'webpage' : 'text', rawText, summary: option(args, '--summary')?.trim() || rawText.slice(0, 240), capturedAt: now(), extractionMethod: 'manual-cli', confidence: 0.5, tags: [], entityIds: [], relationshipIds: [] };
    await store.write({ ...data, evidence: [...data.evidence, record] });
    return print(record);
  }
  if (domain === 'evidence' && action === 'list') {
    const caseId = requireValue(option(args, '--case', true), 'case ID');
    requireCase(data, caseId);
    return print(data.evidence.filter((item) => item.caseId === caseId));
  }

  if (domain === 'ingest' && action === 'page') {
    const caseRecord = requireCase(data, requireValue(option(args, '--case', true), 'case ID'));
    const url = requireValue(option(args, '--url', true), 'URL');
    const page = await fetchPublicPage(url);
    const record = { id: makeId('evidence'), caseId: caseRecord.id, sourceUrl: url, contentType: 'webpage', mimeType: page.contentType, rawText: page.text, summary: page.title, capturedAt: now(), extractionMethod: 'public-web-page-fetch', confidence: 0.5, tags: [], entityIds: [], relationshipIds: [] };
    await store.write({ ...data, evidence: [...data.evidence, record] });
    return print(record);
  }

  if (domain === 'report' && action === 'generate') {
    const caseRecord = requireCase(data, requireValue(option(args, '--case', true), 'case ID'));
    return print(renderReport(reportFor(caseRecord, data.evidence.filter((item) => item.caseId === caseRecord.id))));
  }

  if (domain === 'export' && action === 'obsidian') {
    const caseRecord = requireCase(data, requireValue(option(args, '--case', true), 'case ID'));
    const output = resolve(requireValue(option(args, '--out', true), 'output directory'));
    const evidence = data.evidence.filter((item) => item.caseId === caseRecord.id);
    const notes = exportBundle(caseRecord, evidence, reportFor(caseRecord, evidence));
    for (const note of notes) {
      const path = join(output, note.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${note.content}\n`, 'utf8');
    }
    return print({ output, notes: notes.map((note) => note.path) });
  }

  throw new CliError(`Unknown command: ${argv.join(' ')}`);
}

function printHelp() {
  print(`Hephaestus CLI\n\nUsage: node scripts/hephaestus.mjs <command>\n\nCommands:\n  case create <objective> [--title <title>]\n  case list\n  case show <case-id>\n  evidence add --case <case-id> [--url <url>] --text <text>\n  evidence list --case <case-id>\n  ingest page --case <case-id> --url <url>\n  report generate --case <case-id>\n  export obsidian --case <case-id> --out <vault-path>\n\nSet HEPHAESTUS_DATA_DIR to choose the local data directory.`);
}

function safeMessage(error) {
  return error instanceof Error ? error.message.replace(/(token|secret|password|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=[REDACTED]') : 'Unknown error';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    process.stderr.write(`Error: ${safeMessage(error)}\n`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  });
}
