import { createFileRoute } from "@tanstack/react-router";
import { openClawSkill } from "@/lib/agent/connectors";
import { agentOptions, agentText } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/skill")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async ({ request }) =>
        agentText(openClawSkill(new URL(request.url).origin), "text/markdown; charset=utf-8"),
    },
  },
});
