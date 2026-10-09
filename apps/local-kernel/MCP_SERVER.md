# Efesto MCP Server

Expose your local Efesto Kernel knowledge — Goals, Missions, Cases and their Evidence receipts — as **read-only tools over the Model Context Protocol**. Authorized MCP clients (Claude Desktop, Cursor, Windsurf, Hermes…) receive stored snapshots and provenance. The server has no network transport, but a client may forward returned data to its model provider. Configure the client's privacy settings before sharing private knowledge.

## Why this matters

Most agent memory is a blob of embeddings with no provenance. Efesto's memory is different: every Case carries its Evidence receipts (source URLs, capture timestamps, confidence). When a model answers using `get_case`, you can trace every claim back to what was actually observed.

## Quick start (2 minutes)

1. Find your Kernel data dir:
   - Data dir: `.hephaestus/` in your Efesto install (or `HEPHAESTUS_DATA_DIR`)
   - No Kernel token is required for stdio. File access is inherited from the process that launches this server.

2. Register the server in your MCP client, e.g. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "efesto": {
      "command": "node",
      "args": ["C:\\path\\to\\internet-brain-os\\apps\\local-kernel\\mcp-server.mjs"],
      "env": {
        "HEPHAESTUS_DATA_DIR": "C:\\path\\to\\.hephaestus"
      }
    }
  }
}
```

3. Restart the client. You should see five tools: `kernel_status`, `list_goals`, `list_missions`, `list_cases`, `get_case`.

## Tools (all read-only)

| Tool | What it returns |
|---|---|
| `kernel_status` | Local configuration and process/file-permission trust boundary, not live Kernel health. Legacy token-format diagnostic only. No secrets. |
| `list_goals` | Active Goals sorted by priority then recency. |
| `list_missions` | Hermes missions exactly as persisted, newest first. Expired leases are not repaired. |
| `list_cases` | Cases with Evidence-backed titles and statuses. |
| `get_case` | One Case plus its stored Evidence receipts (source URL, capture time, summary). |

Every tool declares `readOnlyHint: true`. The server cannot mutate Kernel state — writes go only through the authenticated loopback Kernel API, exactly as before.

## Security model

- **Stdio transport only**: the server speaks JSON-RPC 2.0 on stdin/stdout with the process that launched it. It opens no port and accepts no network connections.
- **Token never echoed**: `kernel_status` reports whether a token is configured, never its value.
- **Local process trust**: launch only from a client you authorize to read the selected directory. A legacy `HEPHAESTUS_API_TOKEN` is checked only for valid format; it is not compared with the Kernel credential and does not authenticate this stdio session. Prefer omitting it.
- **Read-only by construction**: no tool handler touches a store mutation path.
- **Snapshots, not reconciliation**: the server reads `store.json` directly and never invokes mission managers, repairs leases, settles verification or creates a missing store. Only the Kernel performs those transitions.

## Verify it works

```bash
cd apps/local-kernel
pnpm exec vitest run mcp-server.test.mjs
# expect: 9 passed / 0 failed
```

The contract suite spawns the real server and speaks newline-delimited JSON-RPC: handshake, tool schemas, round-trips, expired/historical missions, exact unchanged store bytes after every tool, absent/corrupt storage, malformed arguments, and structured errors without crashes. Synthetic records establish these contracts, not compatibility with every external MCP client.
