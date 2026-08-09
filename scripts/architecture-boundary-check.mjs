import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PROTECTED_KERNEL_AREAS = Object.freeze([
  'approval',
  'case',
  'claim',
  'deduplication',
  'entity',
  'evidence',
  'goal',
  'goal-evaluation',
  'knowledge',
  'knowledge-graph',
  'memory',
]);

export const FORBIDDEN_EXTERNAL_PREFIXES = Object.freeze([
  'openai',
  '@openai/',
  'anthropic',
  '@anthropic-ai/',
  'ollama',
  'langchain',
  '@langchain/',
  'redis',
  'ioredis',
  'qdrant',
  '@qdrant/',
  'e2b',
  '@e2b/',
  'dockerode',
  '@opentelemetry/',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const IMPORT_SPECIFIER_PATTERN = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

function isForbiddenExternal(specifier) {
  return FORBIDDEN_EXTERNAL_PREFIXES.some((prefix) =>
    specifier === prefix.replace(/\/$/, '') || specifier.startsWith(prefix),
  );
}

function isForbiddenInternal(specifier) {
  const normalized = specifier.replaceAll('\\', '/');
  return (
    normalized.includes('/apps/') ||
    normalized.startsWith('apps/') ||
    normalized.includes('/packages/connectors/') ||
    normalized.startsWith('packages/connectors/') ||
    normalized.includes('/adapters/') ||
    normalized.includes('/infrastructure/')
  );
}

export function inspectSource(source, filePath = '<memory>') {
  const violations = [];
  IMPORT_SPECIFIER_PATTERN.lastIndex = 0;

  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1];
    if (isForbiddenExternal(specifier)) {
      violations.push({
        filePath,
        specifier,
        reason: 'provider-or-infrastructure dependency inside protected Kernel authority code',
      });
      continue;
    }

    if (isForbiddenInternal(specifier)) {
      violations.push({
        filePath,
        specifier,
        reason: 'outward dependency from protected Kernel authority code',
      });
    }
  }

  return violations;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function findArchitectureViolations(repoRoot = process.cwd()) {
  const kernelRoot = path.join(repoRoot, 'packages', 'kernel', 'src');
  const violations = [];

  for (const area of PROTECTED_KERNEL_AREAS) {
    const directory = path.join(kernelRoot, area);
    let files;
    try {
      files = await collectSourceFiles(directory);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }

    for (const filePath of files) {
      const source = await readFile(filePath, 'utf8');
      violations.push(...inspectSource(source, path.relative(repoRoot, filePath)));
    }
  }

  return violations;
}

async function main() {
  const violations = await findArchitectureViolations();
  if (violations.length === 0) {
    console.log('Architecture boundary check passed: protected Hephaestus authority modules remain provider-neutral.');
    return;
  }

  console.error('Architecture boundary check failed.');
  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.specifier} (${violation.reason})`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
