# Efesto MCP — 5-minute builder quickstart

Efesto is a local-first evidence and memory-safety Kernel for AI agents.

This quickstart is for a developer who already uses an MCP client such as Claude Desktop or Cursor and wants to inspect Efesto's existing Kernel knowledge without changing the Kernel's authority boundaries.

## What you will prove

```text
Goal → research → Case → Evidence → provenance
```

The MCP surface is read-only. It does not admit memory, mutate Goals, execute web access, or grant an agent authority. Mutations remain behind the authenticated local Kernel API.

## 1. Install Efesto

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm build
```

For the normal Windows first-run path, use `Install Efesto.cmd` from the repository root.

## 2. Start or configure the local Kernel

Use the normal Efesto launcher/installer path for your platform. The MCP server reads the same local `.hephaestus` data directory used by the Kernel.

You need these environment variables for the MCP client process:

```text
HEPHAESTUS_DATA_DIR=<your Efesto .hephaestus directory>
HEPHAESTUS_API_TOKEN=<your local Kernel token>
```

The MCP server never returns the token. It exposes only whether a valid token is configured.

## 3. Connect the MCP server

Configure your MCP client to launch:

```json
{
  "command": "node",
  "args": ["apps/local-kernel/mcp-server.mjs"],
  "env": {
    "HEPHAESTUS_DATA_DIR": "<your .hephaestus directory>",
    "HEPHAESTUS_API_TOKEN": "<your kernel token>"
  }
}
```

Use an absolute repository path if your MCP client does not launch from the repository root.

## 4. Verify the connection

Ask your MCP client to call:

```text
kernel_status
```

Then:

```text
list_goals
list_cases
```

All Efesto MCP tools are read-only.

## 5. Run one real Goal

Create or use **one Goal that matters to you**. Do not use a synthetic demo if you already have a real research workflow.

If you need a neutral first test, use:

> Research a public topic where multiple sources may disagree. Identify what can be directly supported by sources, separate those observations from model interpretation, and preserve the source provenance.

Then replace that Goal with your own research problem.

## 6. Inspect the resulting Case

After the research workflow creates a Case, call:

```text
list_cases
```

Take the returned Case id and call:

```text
get_case(caseId="<returned-case-id>")
```

You should be able to identify:

- the Case itself;
- the Evidence records attached to it;
- source URL/provenance;
- capture timestamp;
- Evidence content hash;
- the distinction between stored source material and interpretation made by the agent/client.

## The test that matters

Do not ask whether Efesto looks impressive.

Ask:

> **Can I understand what my agent actually observed, where it came from, and what is interpretation without the Efesto author explaining it to me?**

If yes, the Golden Path is doing its job.

## Current MCP tools

- `kernel_status` — local Kernel readiness, no secrets.
- `list_goals` — persisted Goals.
- `list_missions` — persisted research mission state.
- `list_cases` — persisted Cases.
- `get_case` — one Case plus its stored Evidence.

## Safety boundary

The MCP surface is intentionally read-only. It cannot become an alternate authority path around the Kernel. An agent is never the Kernel, and search text or model output is not automatically Evidence or durable memory.
