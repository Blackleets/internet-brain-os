#!/usr/bin/env node
/**
 * Efesto MCP Server — exposes read-only Kernel knowledge over the
 * Model Context Protocol (stdio transport, newline-delimited JSON-RPC 2.0).
 *
 * Design invariants (CONSTITUTION.md):
 * - Read-only: every tool is a query. Nothing here mutates Kernel state.
 * - Local-only: binds to nothing; speaks only on stdio to the client that
 *   launched it, inheriting this machine's file permissions.
 * - Evidence-backed: responses carry ids and provenance fields so a model's
 *   claims remain traceable to stored Cases/Evidence.
 *
 * Configure in any MCP client (e.g. Claude Desktop):
 *   { "command": "node", "args": ["apps/local-kernel/mcp-server.mjs"],
 *     "env": { "HEPHAESTUS_DATA_DIR": "<your .hephaestus dir>" } }
 * Stdio trusts the launching process's file permissions. A legacy token is only a
 * format diagnostic; it is not authenticated against the running Kernel.
 */
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { LocalKnowledgeStore } from './capture-projector.mjs';
import { validateApiToken } from './api-token-store.mjs';

const SERVER_INFO = { name: 'efesto-kernel', version: '0.1.0' };
const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26'];
const dataDir = resolve(process.env.HEPHAESTUS_DATA_DIR ?? '.hephaestus');
const tokenConfigured = Boolean(
  process.env.HEPHAESTUS_API_TOKEN && (() => {
    try { return validateApiToken(process.env.HEPHAESTUS_API_TOKEN); } catch { return false; }
  })(),
);

const knowledgeStore = new LocalKnowledgeStore(resolve(dataDir, 'store.json'));
// MCP only reads snapshots. In particular, AgentMissionManager.list() reconciles and
// may persist transitions; it must never be used by a read-only MCP tool.
const readKnowledge = () => knowledgeStore.read();

/** Read-only tool implementations. Every handler returns JSON-serializable data. */
const tools = {
  kernel_status: {
    description: 'Efesto local data configuration, not live Kernel health. A legacy token-format diagnostic is not authentication. No secrets are returned.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      return {
        ok: true,
        tokenConfigured,
        dataDir,
        accessBoundary: 'local_process_file_permissions',
        tokenPurpose: 'format_diagnostic_only',
        note: 'Read-only stored snapshots, not live readiness. Trust only authorized local clients; mutations must go through the authenticated loopback Kernel API.',
      };
    },
  },
  list_goals: {
    description: 'List active Goals tracked by the local Kernel, sorted by priority then recency.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      const data = await readKnowledge();
      const goals = data.goals.filter((item) => item?.status === 'active')
        .sort((left, right) => Number(right.priority ?? 0) - Number(left.priority ?? 0)
          || String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')));
      return { ok: true, goals };
    },
  },
  list_missions: {
    description: 'List Hermes missions as stored (queued/running/completed/failed). Expired leases are not repaired; only the Kernel may reconcile them.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      const data = await readKnowledge();
      const missions = [...data.agentMissions].sort((a, b) => String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')));
      return { ok: true, missions };
    },
  },
  list_cases: {
    description: 'List Cases with their Evidence-backed titles and statuses.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async handler() {
      const data = await readKnowledge();
      const cases = data.cases.filter((item) => item?.status !== 'archived' && typeof item?.id === 'string')
        .map((item) => ({ id: item.id, title: item.title ?? item.objective ?? item.id, status: item.status ?? 'draft' }));
      return { ok: true, cases };
    },
  },
  get_case: {
    description: 'Get one Case by id together with its stored Evidence receipts (source URLs, capture timestamps, summaries).',
    inputSchema: {
      type: 'object',
      required: ['caseId'],
      properties: { caseId: { type: 'string', minLength: 1, maxLength: 200, description: 'Case identifier, e.g. "case-1"' } },
      additionalProperties: false,
    },
    async handler({ caseId }) {
      if (typeof caseId !== 'string' || !caseId.trim() || caseId.length > 200) throw new Error('A bounded caseId is required');
      const data = await readKnowledge();
      const record = data.cases.find((item) => item?.id === caseId);
      if (!record) throw new Error('Case not found');
      return { ok: true, case: record, evidence: data.evidence.filter((item) => item?.caseId === caseId) };
    },
  },
};

const TOOL_DEFINITIONS = Object.entries(tools).map(([name, tool]) => ({
  name,
  description: tool.description,
  inputSchema: tool.inputSchema,
  annotations: { readOnlyHint: true },
}));

function jsonRpc(id, result) {
  return `${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`;
}

function jsonRpcError(id, code, message) {
  return `${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`;
}

async function dispatch(method, params) {
  switch (method) {
    case 'initialize': {
      const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18';
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
      return { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO };
    }
    case 'notifications/initialized':
      return undefined; // notification: no response
    case 'tools/list':
      return { tools: TOOL_DEFINITIONS };
    case 'tools/call': {
      const name = params?.name;
      const tool = Object.hasOwn(tools, name) ? tools[name] : undefined;
      if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
      try {
        const args = params?.arguments ?? {};
        if (typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some((key) => !Object.hasOwn(tool.inputSchema.properties, key))) {
          throw new Error('Invalid tool arguments');
        }
        const payload = await tool.handler(args);
        return {
          content: [{ type: 'text', text: JSON.stringify(payload) }],
          isError: false,
        };
      } catch (error) {
        // Tool-level failure stays structured and keeps the server alive.
        return {
          content: [{ type: 'text', text: `Tool ${name} failed: ${error.message}` }],
          isError: true,
        };
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
  }
}

const readline = createInterface({ input: process.stdin });
readline.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    process.stdout.write(jsonRpcError(null, -32700, 'Parse error'));
    return;
  }
  void dispatch(message.method, message.params).then((result) => {
    if (result === undefined) return; // handled notification
    process.stdout.write(jsonRpc(message.id, result));
  }).catch((error) => {
    process.stdout.write(jsonRpcError(message.id, error.code ?? -32603, error.message));
  });
});

// Keep the process alive on an idle stdin; exit cleanly when the client closes it.
readline.on('close', () => process.exit(0));
