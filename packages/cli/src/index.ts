#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { ReportGenerator } from '@internet-brain-os/kernel';
import { ObsidianExporter } from '@internet-brain-os/obsidian';
import type { Case, CaseId, Confidence, Evidence, EvidenceId, IsoDateTime, ReportId } from '@internet-brain-os/shared';

interface StoreData {
  readonly cases: readonly Case[];
  readonly evidence: readonly Evidence[];
}

const EMPTY_STORE: StoreData = { cases: [], evidence: [] };

class CliError extends Error {
  constructor(message: string, readonly exitCode = 2) {
    super(message);
    this.name = 'CliError';
  }
}

class JsonStore {
  constructor(private readonly path: string) {}

  async read(): Promise<StoreData> {
    try {
      const parsed = JSON.parse(await readFile(this.path, 'utf8')) as Partial<StoreData>;
      return {
        cases: Array.isArray(parsed.cases) ? parsed.cases : [],
        evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_STORE;
      throw new CliError(`Unable to read local data: ${safeMessage(error)}`);
    }
  }

  async write(data: StoreData): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await writeFile(this.path, await readFile(temporary));
  }
}

function now(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

function id<T extends string>(prefix: string): T {
  return `${prefix}:${randomUUID()}` as T;
}

function option(args: readonly string[], name: string, required = false): string | undefined {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : undefined;
  if (required && (!value || value.startsWith('--'))) throw new CliError(`Missing required option ${name}`);
  return value;
}

function requireArg(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new CliError(`Missing required ${label}`);
  return value.trim();
}

function findCase(data: StoreData, rawId: string): Case {
  const found = data.cases.find((item) => item.id === rawId);
  if (!found) throw new CliError(`Case not found: ${rawId}`, 3);
  return found;
}

function print(value: unknown): void {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

function renderReport(report: ReturnType<ReportGenerator['generate']>): string {
  return [
    `# ${report.title}`,
    '',
    ...report.sections.flatMap((section) => [`## ${section.heading}`, section.content, '']),
    '## Limitations',
    ...report.limitations.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

async function fetchPublicPage(url: string): Promise<{ title: string; text: string; contentType: string }> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new CliError('Only public HTTP(S) URLs are supported');
  const response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new CliError(`Page fetch failed with HTTP ${response.status}`);
  const body = await response.text();
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() ?? parsed.hostname;
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return { title, text: text.slice(0, 200_000), contentType: response.headers.get('content-type') ?? 'text/html' };
}

export async function run(argv = process.argv.slice(2), env = process.env): Promise<void> {
  const dataDir = resolve(env.HEPHAESTUS_DATA_DIR ?? join(process.cwd(), '.hephaestus'));
  const store = new JsonStore(join(dataDir, 'store.json'));
  const [domain, action, ...args] = argv;
  if (!domain || domain === 'help' || domain === '--help') return printHelp();

  const data = await store.read();

  if (domain === 'case' && action === 'create') {
    const objective = requireArg(args[0], 'objective');
    const timestamp = now();
    const record: Case = {
      id: id<CaseId>('case'),
      title: option(args, '--title')?.trim() || objective.slice(0, 100),
      objective,
      status: 'draft',
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await store.write({ ...data, cases: [...data.cases, record] });
    print(record);
    return;
  }

  if (domain === 'case' && action === 'list') return print(data.cases);
  if (domain === 'case' && action === 'show') return print(findCase(data, requireArg(args[0], 'case ID')));

  if (domain === 'evidence' && action === 'add') {
    const caseRecord = findCase(data, requireArg(option(args, '--case', true), 'case ID'));
    const rawText = requireArg(option(args, '--text', true), 'evidence text');
    const sourceUrl = option(args, '--url');
    if (sourceUrl) new URL(sourceUrl);
    const record: Evidence = {
      id: id<EvidenceId>('evidence'),
      caseId: caseRecord.id,
      sourceUrl,
      contentType: sourceUrl ? 'webpage' : 'text',
      rawText,
      summary: option(args, '--summary')?.trim() || rawText.slice(0, 240),
      capturedAt: now(),
      extractionMethod: 'manual-cli',
      confidence: 0.5 as Confidence,
      tags: [],
      entityIds: [],
      relationshipIds: [],
    };
    await store.write({ ...data, evidence: [...data.evidence, record] });
    print(record);
    return;
  }

  if (domain === 'evidence' && action === 'list') {
    const caseId = requireArg(option(args, '--case', true), 'case ID');
    findCase(data, caseId);
    return print(data.evidence.filter((item) => item.caseId === caseId));
  }

  if (domain === 'ingest' && action === 'page') {
    const caseRecord = findCase(data, requireArg(option(args, '--case', true), 'case ID'));
    const url = requireArg(option(args, '--url', true), 'URL');
    const page = await fetchPublicPage(url);
    const record: Evidence = {
      id: id<EvidenceId>('evidence'),
      caseId: caseRecord.id,
      sourceUrl: url,
      contentType: 'webpage',
      mimeType: page.contentType,
      rawText: page.text,
      summary: page.title,
      capturedAt: now(),
      extractionMethod: 'public-web-page-fetch',
      confidence: 0.5 as Confidence,
      tags: [],
      entityIds: [],
      relationshipIds: [],
    };
    await store.write({ ...data, evidence: [...data.evidence, record] });
    print(record);
    return;
  }

  if (domain === 'report' && action === 'generate') {
    const caseRecord = findCase(data, requireArg(option(args, '--case', true), 'case ID'));
    const evidence = data.evidence.filter((item) => item.caseId === caseRecord.id);
    const report = new ReportGenerator().generate({
      id: id<ReportId>('report'),
      caseRecord,
      evidence,
      generatedAt: now(),
    });
    print(renderReport(report));
    return;
  }

  if (domain === 'export' && action === 'obsidian') {
    const caseRecord = findCase(data, requireArg(option(args, '--case', true), 'case ID'));
    const out = resolve(requireArg(option(args, '--out', true), 'output directory'));
    const evidence = data.evidence.filter((item) => item.caseId === caseRecord.id);
    const generatedAt = now();
    const report = new ReportGenerator().generate({ id: id<ReportId>('report'), caseRecord, evidence, generatedAt });
    const bundle = new ObsidianExporter().exportCase(caseRecord, evidence, report);
    for (const note of bundle.notes) {
      const path = join(out, note.path);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, `${note.content}\n`, 'utf8');
    }
    print({ output: out, notes: bundle.notes.map((note) => note.path) });
    return;
  }

  throw new CliError(`Unknown command: ${argv.join(' ')}`);
}

function printHelp(): void {
  print(`Hephaestus CLI\n\nCommands:\n  case create <objective> [--title <title>]\n  case list\n  case show <case-id>\n  evidence add --case <case-id> [--url <url>] --text <text>\n  evidence list --case <case-id>\n  ingest page --case <case-id> --url <url>\n  report generate --case <case-id>\n  export obsidian --case <case-id> --out <vault-path>\n\nSet HEPHAESTUS_DATA_DIR to choose the local data directory.`);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.replace(/(?:token|secret|password|api[_-]?key)\s*[=:]\s*\S+/gi, '$1=[REDACTED]') : 'Unknown error';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = error instanceof CliError ? error.exitCode : 1;
  });
}
