import { createServer } from 'node:net';

const MAX_DEFAULT_CANDIDATES = 20;

export async function selectInternalPort(options = {}) {
  const externalPort = Number(options.externalPort);
  const requested = options.requestedPort;
  const host = options.host ?? '127.0.0.1';
  const isPortAvailable = options.isPortAvailable ?? canBindPort;
  const maxCandidates = Number(options.maxCandidates ?? MAX_DEFAULT_CANDIDATES);

  assertValidPort(externalPort, 'external Kernel port');

  if (requested !== undefined && requested !== null && String(requested).trim() !== '') {
    const requestedPort = Number(requested);
    assertValidPort(requestedPort, 'HEPHAESTUS_INTERNAL_PORT');
    if (requestedPort === externalPort) throw new Error('Kernel ports must be distinct');
    if (!(await isPortAvailable(requestedPort, host))) {
      throw new Error(`HEPHAESTUS_INTERNAL_PORT ${requestedPort} is already in use`);
    }
    return requestedPort;
  }

  if (!Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 100) {
    throw new Error('Internal Kernel port scan limit must be between 1 and 100');
  }

  for (let offset = 1; offset <= maxCandidates; offset += 1) {
    const candidate = externalPort + offset;
    if (candidate > 65535) break;
    if (await isPortAvailable(candidate, host)) return candidate;
  }

  throw new Error(`No free internal Kernel port was found after ${maxCandidates} candidates`);
}

export async function canBindPort(port, host = '127.0.0.1') {
  return new Promise((resolvePromise) => {
    const server = createServer();
    let settled = false;
    const finish = (available) => {
      if (settled) return;
      settled = true;
      server.removeAllListeners();
      if (server.listening) server.close(() => resolvePromise(available));
      else resolvePromise(available);
    };

    server.once('error', () => finish(false));
    server.listen({ port, host, exclusive: true }, () => finish(true));
  });
}

function assertValidPort(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${label} must be a valid TCP port`);
  }
}
