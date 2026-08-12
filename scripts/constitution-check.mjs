import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const requiredEntryPoints = [
  'AGENTS.md',
  'README.md',
  'ARCHITECTURE.md',
  'PROJECT_STATE.md',
  'PROJECT_DNA.md',
  'PROJECT_BIBLE.md',
  'AGENT_ROLES.md',
  'LLM_HANDOFF.md',
  'docs/hermes-operating-protocol.md',
];

export async function checkConstitution({ root = repositoryRoot } = {}) {
  const constitutionPath = resolve(root, 'CONSTITUTION.md');
  const constitution = await readFile(constitutionPath, 'utf8');

  if (!constitution.includes('# EFESTO CONSTITUTION')) {
    throw new Error('CONSTITUTION.md is missing its canonical title');
  }

  for (const relativePath of requiredEntryPoints) {
    const entryPath = resolve(root, relativePath);
    await access(entryPath);
    const entryPoint = await readFile(entryPath, 'utf8');
    if (!entryPoint.includes('CONSTITUTION.md')) {
      throw new Error(`${relativePath} does not require the canonical CONSTITUTION.md preflight`);
    }
  }

  return {
    constitutionPath,
    requiredEntryPoints,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await checkConstitution();
    process.stdout.write(`Constitution preflight passed: ${result.requiredEntryPoints.length} agent entry points require CONSTITUTION.md first.\n`);
  } catch (error) {
    process.stderr.write(`Constitution preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
