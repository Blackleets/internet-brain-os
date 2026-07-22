const VALID_KERNEL = new Set(['ready', 'offline', 'stale', 'port_conflict', 'failed']);
const VALID_HERMES = new Set(['ready', 'missing', 'invalid', 'failed']);
const VALID_OBSIDIAN = new Set(['ready', 'not_configured', 'unwritable', 'failed']);
const VALID_PAIRING = new Set(['paired', 'required', 'invalid']);

export function deriveEfestoBootstrapStatus(input = {}) {
  const kernel = deriveKernelStatus(input.kernelProbe, input.processProbe);
  const hermes = deriveHermesStatus(input.hermesProbe);
  const obsidian = deriveObsidianStatus(input.obsidianProbe);
  const pairing = derivePairingStatus(input.pairingProbe);
  const overall = input.repairProbe?.attempted === true && input.repairProbe?.ok === false
    ? 'failed'
    : deriveOverall({ kernel, hermes, obsidian, pairing });
  const diagnostics = sanitizeDiagnostics({
    kernel: kernelDiagnostics(input.kernelProbe, input.processProbe),
    hermes: hermesDiagnostics(input.hermesProbe),
    obsidian: obsidianDiagnostics(input.obsidianProbe),
    pairing: pairingDiagnostics(input.pairingProbe),
    repair: input.repairProbe ? sanitizeObject(input.repairProbe) : undefined,
  });
  return {
    schemaVersion: 'efesto.bootstrap-status.v1',
    ok: overall === 'ready',
    kernel: assertEnum(kernel, VALID_KERNEL, 'kernel'),
    hermes: assertEnum(hermes, VALID_HERMES, 'hermes'),
    obsidian: assertEnum(obsidian, VALID_OBSIDIAN, 'obsidian'),
    pairing: assertEnum(pairing, VALID_PAIRING, 'pairing'),
    overall,
    message: userMessage({ kernel, hermes, obsidian, pairing, overall }),
    diagnostics,
    actions: availableActions({ kernel, hermes, obsidian, pairing, overall, processProbe: input.processProbe }),
  };
}

function deriveKernelStatus(kernelProbe = {}, processProbe = {}) {
  if (kernelProbe.failed) return 'failed';
  if (kernelProbe.reachable && kernelProbe.ok && kernelProbe.service === 'hephaestus-local-kernel') return 'ready';
  if (kernelProbe.reachable && kernelProbe.service && kernelProbe.service !== 'hephaestus-local-kernel') return 'port_conflict';
  if (kernelProbe.portOpen && !kernelProbe.ok) return 'port_conflict';
  if (processProbe.pidFilePresent && processProbe.alive && processProbe.owned && !kernelProbe.reachable) return 'stale';
  if (processProbe.pidFilePresent && !processProbe.alive) return 'stale';
  return 'offline';
}

function deriveHermesStatus(hermesProbe = {}) {
  if (hermesProbe.failed) return 'failed';
  if (!hermesProbe.found) return 'missing';
  if (!hermesProbe.valid) return 'invalid';
  return 'ready';
}

function deriveObsidianStatus(obsidianProbe = {}) {
  if (obsidianProbe.failed) return 'failed';
  if (!obsidianProbe.configured) return 'not_configured';
  if (!obsidianProbe.writable) return 'unwritable';
  return 'ready';
}

function derivePairingStatus(pairingProbe = {}) {
  if (pairingProbe.invalid) return 'invalid';
  if (!pairingProbe.tokenPresent || !pairingProbe.paired) return 'required';
  return 'paired';
}

function deriveOverall({ kernel, hermes, obsidian, pairing }) {
  if (kernel === 'ready' && hermes === 'ready' && obsidian === 'ready' && pairing === 'paired') return 'ready';
  if (kernel === 'failed' || kernel === 'stale' || kernel === 'port_conflict' || hermes === 'failed' || obsidian === 'failed' || pairing === 'invalid') return 'failed';
  return 'needs_setup';
}

function userMessage(state) {
  if (state.overall === 'ready') return 'Efesto is ready. Open the extension and press the central orb.';
  if (state.kernel === 'port_conflict') return 'Port 4000 is already used by another service. Close that service or change the Efesto port.';
  if (state.kernel === 'stale') return 'An old Efesto Kernel process was detected. Use Repair to clean the stale launcher record safely.';
  if (state.kernel === 'offline') return 'Efesto needs setup. Use Repair to start the local Kernel and verify services.';
  if (state.hermes === 'missing') return 'Hermes was not found. Install Hermes Agent or configure the Hermes executable, then use Repair.';
  if (state.hermes === 'invalid') return 'Hermes was found but did not pass the Efesto adapter check.';
  if (state.obsidian === 'not_configured') return 'Choose an Obsidian vault once so Efesto can write private notes.';
  if (state.obsidian === 'unwritable') return 'Efesto cannot write to the configured Obsidian vault. Check folder permissions or choose another vault.';
  if (state.pairing === 'required') return 'Pair the extension once. The private credential stays hidden.';
  return 'Efesto needs attention. Review diagnostics or use Repair for recoverable checks.';
}

function availableActions({ overall, kernel, hermes, obsidian, pairing, processProbe = {} }) {
  const actions = [];
  if (overall === 'ready') actions.push(action('open_efesto', 'Open Efesto'));
  if (overall !== 'ready' || ['offline', 'stale', 'port_conflict'].includes(kernel) || hermes !== 'ready' || obsidian !== 'ready' || pairing !== 'paired') actions.push(action('repair', 'Repair'));
  if (kernel === 'ready' && processProbe.owned === true && processProbe.pid) actions.push(action('shutdown', 'Shut down safely'));
  if (pairing === 'required') actions.push(action('pair_extension', 'Pair extension'));
  return actions;
}

function action(id, label) { return { id, label, recoverable: id !== 'open_efesto' }; }

function kernelDiagnostics(kernelProbe = {}, processProbe = {}) {
  return sanitizeObject({
    reachable: Boolean(kernelProbe.reachable),
    ok: Boolean(kernelProbe.ok),
    service: kernelProbe.service,
    port: kernelProbe.port,
    ageMs: kernelProbe.ageMs,
    pid: processProbe.pid,
    pidFilePresent: Boolean(processProbe.pidFilePresent),
    alive: processProbe.alive,
    owned: processProbe.owned,
    reason: kernelProbe.error,
  });
}

function hermesDiagnostics(hermesProbe = {}) {
  return sanitizeObject({ found: Boolean(hermesProbe.found), valid: Boolean(hermesProbe.valid), executable: hermesProbe.executable, reason: hermesProbe.error });
}

function obsidianDiagnostics(obsidianProbe = {}) {
  return sanitizeObject({ configured: Boolean(obsidianProbe.configured), writable: Boolean(obsidianProbe.writable), path: obsidianProbe.path, vaultRelativePath: obsidianProbe.vaultRelativePath, reason: obsidianProbe.error });
}

function pairingDiagnostics(pairingProbe = {}) {
  return sanitizeObject({ credentialPresent: Boolean(pairingProbe.tokenPresent), paired: Boolean(pairingProbe.paired), registryPresent: Boolean(pairingProbe.registryPresent), reason: pairingProbe.error });
}

function assertEnum(value, values, label) {
  if (!values.has(value)) throw new Error(`Invalid ${label} bootstrap status: ${value}`);
  return value;
}

export function sanitizeDiagnostics(value) {
  return sanitizeObject(value);
}

function sanitizeObject(value) {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') return sanitizeScalar(value);
  if (Array.isArray(value)) return value.map(sanitizeObject);
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [redactKey(key), sanitizeObject(item)]));
}

function sanitizeScalar(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/\b(?:token|secret|authorization|cookie)\b\s*[:=]\s*\S+/giu, '$1=[REDACTED]')
    .replace(/\b[A-Za-z0-9._~+/=-]{48,}\b/g, '[REDACTED]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 500);
}

function redactKey(key) {
  return /token|secret|authorization|cookie/i.test(key) ? `${key}Configured` : key;
}
