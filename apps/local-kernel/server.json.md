# Efesto MCP Server — Registry Descriptor

This file follows the official MCP Registry `server.json` format
(https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/generic-server-json.md)
so the server can be published to registry.modelcontextprotocol.io once a
public release exists.

```json
{
  "$schema": "https://cdn.jsdelivr.net/npm/@modelcontextprotocol/sdk@latest/schema.json",
  "name": "io.github.blackleets/efesto-kernel",
  "display_name": "Efesto Kernel",
  "description": "Read-only MCP access to your local, evidence-backed knowledge: Goals, research missions, Cases and their Evidence receipts with full provenance (source URLs, capture timestamps, confidence). Local-first: nothing leaves your machine; stdio transport only.",
  "version": "0.1.0",
  "publisher": {
    "name": "Blackleets"
  },
  "repository": {
    "url": "https://github.com/Blackleets/internet-brain-os"
  },
  "serverType": "local",
  "transport": {
    "type": "stdio",
    "command": "node",
    "args": ["apps/local-kernel/mcp-server.mjs"],
    "env": {
      "HEPHAESTUS_DATA_DIR": "<path to your .hephaestus directory>",
      "HEPHAESTUS_API_TOKEN": "<your kernel API token>"
    }
  },
  "tools": [
    { "name": "kernel_status", "readOnlyHint": true, "description": "Kernel configuration status. Never echoes secrets." },
    { "name": "list_goals", "readOnlyHint": true, "description": "Active Goals sorted by priority and recency." },
    { "name": "list_missions", "readOnlyHint": true, "description": "Hermes research missions with lifecycle state." },
    { "name": "list_cases", "readOnlyHint": true, "description": "Cases with Evidence-backed titles and statuses." },
    { "name": "get_case", "readOnlyHint": true, "description": "One Case plus its Evidence receipts (source URL, capture time, summary)." }
  ],
  "permissions": {
    "readFiles": ["<HEPHAESTUS_DATA_DIR>/store.json"]
  },
  "security": {
    "localOnly": true,
    "noNetworkListeners": true,
    "secretsNeverEchoed": true
  }
}
```

## Publishing checklist (when ready for v1.0 public release)

1. Tag a public release of this repository.
2. Validate locally: `npx @modelcontextprotocol/inspector node apps/local-kernel/mcp-server.mjs`
3. Publish: `mcp-publisher init && mcp-publisher publish server.json` (GitHub OIDC flow recommended).
4. Also submit manually to:
   - https://glama.ai/mcp/servers (Submit)
   - https://mcp.directory (Add server)
   - https://github.com/punkpeye/awesome-mcp-servers (PR adding under "Knowledge & Memory")
   - https://github.com/modelcontextprotocol/servers (community list PR if accepted scope)
5. Community channels for launch: Show HN ("Show HN: Efesto – local-first memory with provenance for AI agents"), r/LocalLLaMA, r/selfhosted.
