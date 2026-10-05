import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// This provisioning gate grants no Kernel, Evidence, or memory authority.
export function verifyLiveModelIdentity(tags, show, model, expectedDigest) {
  if (typeof model !== 'string' || !/^[a-z0-9.:_-]{1,160}$/i.test(model)
    || typeof expectedDigest !== 'string' || !/^[a-f0-9]{64}$/.test(expectedDigest)) {
    throw new Error('Live model configuration requires a name and full SHA-256 digest');
  }
  const matches = Array.isArray(tags?.models)
    ? tags.models.filter((item) => item?.name === model) : [];
  if (matches.length !== 1) throw new Error('Expected exactly one reviewed live model');
  const actual = matches[0].digest;
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual)) {
    throw new Error('Live model returned an invalid SHA-256 digest');
  }
  if (actual !== expectedDigest) {
    throw new Error(`Live model identity mismatch: expected=${expectedDigest} actual=${actual}`);
  }
  if (!Array.isArray(show?.capabilities) || !show.capabilities.includes('tools')) {
    throw new Error('Reviewed live model does not advertise tool capability');
  }
  return { model, digest: actual, tools: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = verifyLiveModelIdentity(
      JSON.parse(readFileSync(process.argv[2], 'utf8')),
      JSON.parse(readFileSync(process.argv[3], 'utf8')),
      process.env.OLLAMA_MODEL, process.env.OLLAMA_MODEL_ID,
    );
    console.log(`Verified live model ${result.model} sha256=${result.digest} tools=true`);
  } catch (error) {
    // Never print API response bodies or credentials on a failed provisioning gate.
    console.error(error instanceof SyntaxError ? 'Invalid live model metadata JSON' : error.message);
    process.exitCode = 1;
  }
}
