import { createFileRoute } from "@tanstack/react-router";
import { openApiSpec } from "@/lib/agent/connectors";
import { agentJson, agentOptions } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/openapi")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async ({ request }) => agentJson(openApiSpec(new URL(request.url).origin)),
    },
  },
});
