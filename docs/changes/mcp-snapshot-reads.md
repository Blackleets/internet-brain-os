# MCP reads preserve stored mission state

## Scope and reason

Audit improvement two, authorized after correcting discovery. Keep the existing five stdio tools and payload identities. The old MCP list_missions called AgentMissionManager.list with a string clock. An expired running lease threw now.getTime is not a function. Replacing the clock alone would allow manager reconciliation to write from a purportedly read-only tool.

## Behavior and files

apps/local-kernel/mcp-server.mjs now uses only LocalKnowledgeStore.read snapshots for Goals, missions, Case summaries and Case Evidence. No mission/Goal/projector mutation managers are constructed. Return stored mission states, including expired and verifying states, newest first. The Kernel's own reconciliation remains unchanged. Missing storage stays absent and corrupt JSON remains untouched. Tool arguments enforce declared keys, case identifiers are bounded, inherited names are rejected.

Keep the legacy tokenConfigured field for compatibility and explicitly label it a format diagnostic. Stdio access already depends on the launching process and filesystem permissions; no HTTP authentication gate is removed or added. Document optional legacy tokens, no live-health claim and that a model client can forward returned data remotely. No network transport, OAuth, new dependency or user-store migration.

apps/local-kernel/mcp-server.test.mjs launches the actual process with synthetic expired/verifying/waiting/completed records and checks the exact stored bytes after all five tools. The historical-mission regression fails on the previous implementation; all nine MCP tests pass after the change. Tests also cover absent/corrupt stores, no-token diagnostics, malformed arguments and unknown/inherited names. apps/local-kernel/MCP_SERVER.md corrects setup and the Vitest command.

## Risk, acceptance and rollback

Clients see persisted snapshots rather than repaired state. This is intentional; do not infer active work solely from a running row with an expired lease. Authentication and reconciliation of normal Kernel APIs remain authoritative. Read-only snapshots may contain private data: authorize the local client and its provider route explicitly.

Acceptance: no tool writes, repairs, creates or deletes storage; valid historical rows return without the clock error; corrupt storage fails visibly; existing five tool names and provenance remain. Full candidate qualification and authentic external-client/founder UAT are separate checks.

Rollback only this MCP slice; no data rollback. Candidate .92 supersedes .91; PR #266 stays draft/unmerged and publicLaunchApproved=false.
