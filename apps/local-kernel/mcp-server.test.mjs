import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
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
});
