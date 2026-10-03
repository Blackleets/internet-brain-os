import { createFileRoute } from "@tanstack/react-router";
import { agentDiscovery, agentManifest, handleAgentRpc } from "@/lib/agent/protocol";
import { agentJson, agentOptions, agentText } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const format = url.searchParams.get("format");
        const discovery = agentDiscovery(origin);
        if (format === "openapi") return agentJson(discovery.openapi);
        if (format === "skill") return agentText(discovery.skill, "text/markdown; charset=utf-8");
        if (format === "mcp") return agentJson(discovery.manifest);
        return agentJson(agentManifest(origin));
      },
      POST: async ({ request }) => {
        let body: unknown = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }
        const result = await handleAgentRpc(body, new URL(request.url).origin, {
          userAgent: request.headers.get("user-agent") ?? undefined,
          header: request.headers.get("x-efesto-agent") ?? undefined,
        });
        return agentJson(result);
      },
    },
  },
});
