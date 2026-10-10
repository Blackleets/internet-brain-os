import { describe, it, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * End-to-end contract tests for the Efesto MCP server over stdio.
 * Spawns the real process and speaks newline-delimited JSON-RPC 2.0,
 * exactly like Claude Desktop / Cursor / any MCP client would.
 */
describe('efesto mcp server (stdio)', () => {
  let directory;
  let child;
  let nextId;
  let pending;
  let reader;

  function startServer(extraEnv = {}) {
    child = spawn(process.execPath, ['mcp-server.mjs'], {
      cwd: new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      env: {
        ...process.env,
        HEPHAESTUS_API_TOKEN: 'mcp-contract-token-0123456789abcdef',
        HEPHAESTUS_DATA_DIR: directory,
        ...extraEnv,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = [];
    reader = createInterface({ input: child.stdout });
    reader.on('line', (line) => {
      if (!line.trim()) return;
      const message = JSON.parse(line);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      } else {
        lines.push(message);
      }
    });
  }

  function request(method, params) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }, 5_000);
      pending.set(id, (message) => {
        clearTimeout(timer);
        resolve(message);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'efesto-mcp-'));
    nextId = 1;
    pending = new Map();
  });

  afterEach(async () => {
    if (child && child.exitCode === null) child.kill();
    reader?.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('completes the initialize handshake with tools capability', async () => {
    startServer();
    const response = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'contract-test', version: '0.0.1' },
    });
    assert.equal(response.jsonrpc, '2.0');
    assert.equal(response.result.protocolVersion, '2025-06-18');
    assert.equal(response.result.serverInfo.name, 'efesto-kernel');
    assert.ok(response.result.capabilities.tools);
  });

  it('lists read-only kernel tools with input schemas', async () => {
    startServer();
    await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' },
    });
    const response = await request('tools/list', {});
    const names = response.result.tools.map((tool) => tool.name);
    assert.ok(names.includes('kernel_status'), 'kernel_status tool missing');
    assert.ok(names.includes('list_goals'), 'list_goals tool missing');
    assert.ok(names.includes('list_missions'), 'list_missions tool missing');
    assert.ok(names.includes('list_cases'), 'list_cases tool missing');
    assert.ok(names.includes('get_case'), 'get_case tool missing');
    for (const tool of response.result.tools) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
      assert.ok(tool.inputSchema, `${tool.name} must declare an input schema`);
    }
  });

  it('answers tools/call kernel_status with truthful readiness', async () => {
    startServer();
    await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' },
    });
    const response = await request('tools/call', { name: 'kernel_status', arguments: {} });
    const payload = JSON.parse(response.result.content[0].text);
    assert.equal(payload.ok, true);
    assert.equal(typeof payload.tokenConfigured, 'boolean');
  });

  it('returns structured tool errors without crashing the server', async () => {
    startServer();
    await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' },
    });
    const response = await request('tools/call', { name: 'get_case', arguments: { caseId: 'missing-case' } });
    assert.equal(response.result.isError, true);
    assert.match(response.result.content[0].text, /not found/i);
    // Server must still be alive and answering.
    const alive = await request('tools/list', {});
    assert.ok(Array.isArray(alive.result.tools));
  });

  it('rejects unknown methods with a JSON-RPC error object', async () => {
    startServer();
    await request('initialize', {
      protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' },
    });
    const response = await request('no/such/method', {});
    assert.equal(response.error.code, -32601);
  });

  it('reads historical and expired missions without errors or changes to any stored byte', async () => {
    const missions = [
      { id: 'expired', status: 'running', executionPhase: 'investigating', leaseExpiresAt: '2000-01-01T00:00:00Z', attempt: 1, createdAt: '2026-10-01' },
      { id: 'verifying', status: 'running', executionPhase: 'verifying', searchCandidates: [{ id: 'c1', url: 'https://example.com/a' }], verificationResults: [{ candidateId: 'c1', status: 'verified', supported: false }], createdAt: '2026-10-02' },
      { id: 'waiting', status: 'waiting_for_agent', agent: 'hermes', createdAt: '2026-10-03' },
      { id: 'finished', status: 'completed', executionPhase: 'forged', createdAt: '2026-10-04' },
    ];
    const data = {
      goals: [{ id: 'goal', title: 'Synthetic Goal', status: 'active', priority: 1, createdAt: '2026-10-01' }],
      agentMissions: missions,
      cases: [{ id: 'case-1', title: 'Synthetic Case', status: 'draft' }],
      evidence: [{ id: 'evidence-1', caseId: 'case-1', sourceUrl: 'https://example.com/a', capturedAt: '2026-10-01', contentHash: 'synthetic', rawText: 'Synthetic source' }],
    };
    const file = join(directory, 'store.json');
    const before = JSON.stringify(data, null, 2) + '\n';
    await writeFile(file, before);
    startServer({ HEPHAESTUS_API_TOKEN: '' });
    for (const name of ['kernel_status', 'list_goals', 'list_missions', 'list_cases', 'get_case']) {
      const response = await request('tools/call', { name, arguments: name === 'get_case' ? { caseId: 'case-1' } : {} });
      assert.equal(response.result.isError, false, JSON.stringify(response));
      const payload = JSON.parse(response.result.content[0].text);
      if (name === 'list_missions') assert.deepEqual(payload.missions, [...missions].reverse());
      if (name === 'get_case') assert.deepEqual(payload.evidence, data.evidence);
      assert.equal(await readFile(file, 'utf8'), before, `${name} changed the snapshot`);
    }
    assert.deepEqual(await readdir(directory), ['store.json']);
  });

  it('does not create a missing store and reports the local process trust boundary without a token', async () => {
    startServer({ HEPHAESTUS_API_TOKEN: '' });
    const status = await request('tools/call', { name: 'kernel_status' });
    const payload = JSON.parse(status.result.content[0].text);
    assert.equal(payload.tokenConfigured, false);
    assert.equal(payload.accessBoundary, 'local_process_file_permissions');
    assert.equal(payload.tokenPurpose, 'format_diagnostic_only');
    for (const name of ['list_goals', 'list_missions', 'list_cases']) {
      const response = await request('tools/call', { name });
      assert.equal(response.result.isError, false);
    }
    assert.deepEqual(await readdir(directory), []);
  });

  it('keeps corrupt storage unchanged and remains available for structured diagnostics', async () => {
    const file = join(directory, 'store.json');
    const corrupt = '{not valid JSON';
    await writeFile(file, corrupt);
    startServer();
    for (const name of ['list_goals', 'list_missions', 'list_cases', 'get_case']) {
      const response = await request('tools/call', { name, arguments: name === 'get_case' ? { caseId: 'c' } : {} });
      assert.equal(response.result.isError, true);
      assert.equal(await readFile(file, 'utf8'), corrupt);
    }
    assert.ok((await request('tools/list', {})).result.tools.length === 5);
  });

  it('rejects malformed arguments and inherited tool names without crashing or writing', async () => {
    startServer();
    for (const args of [[], 'wrong', { caseId: '' }, { caseId: 'x'.repeat(201) }, { caseId: 'c', authority: 'admitted' }]) {
      const response = await request('tools/call', { name: 'get_case', arguments: args });
      assert.equal(response.result.isError, true);
    }
    assert.equal((await request('tools/call', { name: 'toString' })).error.code, -32602);
    assert.deepEqual(await readdir(directory), []);
  });
});
