import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export async function renderProjectResume({ cwd = process.cwd() } = {}) {
  const checkpoint = await readFile(new URL('../PROJECT_STATE.md', import.meta.url), 'utf8');
  const [branch, commit, status] = await Promise.all([
    git(['branch', '--show-current'], cwd),
    git(['log', '-1', '--oneline', '--decorate'], cwd),
    git(['status', '--short', '--branch'], cwd),
  ]);
  return [
    checkpoint.trimEnd(),
    '',
    '## Git live state',
    '',
    `Branch: ${branch}`,
    `Head: ${commit}`,
    '',
    '```text',
    status,
    '```',
    '',
    'Live Git/GitHub state overrides older checkpoint or chat details.',
    '',
  ].join('\n');
}

async function git(args, cwd) {
  const { stdout } = await exec('git', args, { cwd, encoding: 'utf8' });
  return stdout.trim();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { process.stdout.write(await renderProjectResume()); }
  catch (error) {
    process.stderr.write(`Unable to recover project state: ${error.message}\n`);
    process.exitCode = 1;
  }
}
