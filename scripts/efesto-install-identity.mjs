import { execFile } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const commitPattern = /^[a-f0-9]{40}$/;

// This inspects code identity only: no runtime probes, tokens, config or vault IO.
export async function inspectInstallIdentity({ root = defaultRoot } = {}) {
  let version = null;
  let releaseMetadata = 'unavailable';
  try {
    const release = JSON.parse(await readFile(resolve(root, 'INTERNAL_RELEASE.json'), 'utf8'));
    if (release.schema === 'efesto.internal-release.v1'
      && /^0\.1\.0-internal\.\d+$/.test(release.version)
      && release.channel === 'internal' && release.publicLaunchApproved === false) {
      version = release.version;
      releaseMetadata = 'valid_internal';
    } else releaseMetadata = 'invalid';
  } catch { /* Do not expose parse errors or local paths. */ }

  let commit = null;
  let source = 'unknown';
  let workingTree = 'unavailable';
  try {
    // A package extracted inside another repository must not inherit its identity.
    const top = await git(root, ['rev-parse', '--show-toplevel']);
    if (await realpath(top) === await realpath(root)) {
      const head = await git(root, ['rev-parse', 'HEAD']);
      if (commitPattern.test(head)) {
        commit = head;
        source = 'git_checkout';
        workingTree = (await git(root, ['status', '--porcelain=v1'])).length ? 'modified' : 'clean';
      }
    }
  } catch { /* Missing Git and source archives are supported. */ }
  if (source === 'unknown') {
    try {
      const archived = (await readFile(resolve(root, 'BUILD_COMMIT.txt'), 'utf8')).trim();
      if (commitPattern.test(archived)) { commit = archived; source = 'git_archive'; }
    } catch { /* Older packages correctly remain unknown. */ }
  }
  return {
    schema: 'efesto.install-identity.v1', version, releaseMetadata, commit, source,
    workingTree, runtimeVerified: false, authenticityVerified: false,
  };
}

async function git(root, args) {
  const { stdout } = await exec('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd: root, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await inspectInstallIdentity(), null, 2)}\n`);
}
