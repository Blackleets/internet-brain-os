# Efesto MCP Server

Expose your local Efesto Kernel knowledge — Goals, Missions, Cases and their Evidence receipts — as **read-only tools over the Model Context Protocol**. Any MCP client (Claude Desktop, Cursor, Windsurf, Hermes…) can then answer questions grounded in *your verified, provenance-backed* knowledge. Nothing leaves your machine.

## Why this matters

Most agent memory is a blob of embeddings with no provenance. Efesto's memory is different: every Case carries its Evidence receipts (source URLs, capture timestamps, confidence). When a model answers using `get_case`, you can trace every claim back to what was actually observed.

## Quick start (2 minutes)

1. Find your Kernel data dir and token:
   - Data dir: `.hephaestus/` in your Efesto install (or `HEPHAESTUS_DATA_DIR`)
   - Token: the contents of `.hephaestus/kernel-api-token` (or `HEPHAESTUS_API_TOKEN`)

2. Register the server in your MCP client, e.g. Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "efesto": {
      "command": "node",
      "args": ["C:\\path\\to\\internet-brain-os\\apps\\local-kernel\\mcp-server.mjs"],
      "env": {
        "HEPHAESTUS_DATA_DIR": "C:\\path\\to\\.hephaestus",
        "HEPHAESTUS_API_TOKEN": "<your kernel token>"
      }
    }
  }
}
```

3. Restart the client. You should see five tools: `kernel_status`, `list_goals`, `list_missions`, `list_cases`, `get_case`.

## Tools (all read-only)

| Tool | What it returns |
|---|---|
| `kernel_status` | Whether a valid token is configured and which data dir is in use. No secrets. |
| `list_goals` | Active Goals sorted by priority then recency. |
| `list_missions` | Hermes research missions with lifecycle state (queued → investigating → verifying → forged). |
| `list_cases` | Cases with Evidence-backed titles and statuses. |
| `get_case` | One Case plus its stored Evidence receipts (source URL, capture time, summary). |

Every tool declares `readOnlyHint: true`. The server cannot mutate Kernel state — writes go only through the authenticated loopback Kernel API, exactly as before.

## Security model

- **Stdio transport only**: the server speaks JSON-RPC 2.0 on stdin/stdout with the process that launched it. It opens no port and accepts no network connections.
- **Token never echoed**: `kernel_status` reports whether a token is configured, never its value.
- **Read-only by construction**: no tool handler touches a store mutation path.

## Verify it works

```bash
cd apps/local-kernel
HEPHAESTUS_API_TOKEN=<your token> node --test mcp-server.test.mjs
# expect: # pass 5 / # fail 0
```

The contract suite spawns the real server binary and speaks newline-delimited JSON-RPC like any MCP client would: handshake, tools/list schema checks, tools/call round-trips, structured error handling without crashes, and JSON-RPC `-32601` for unknown methods.
