import { createFileRoute } from "@tanstack/react-router";
import { restForge } from "@/lib/agent/protocol";
import { agentJson, agentOptions } from "@/lib/agent/http";

export const Route = createFileRoute("/api/agent/forge")({
  server: {
    handlers: {
      OPTIONS: async () => agentOptions(),
      GET: async () =>
        agentJson({
          tool: "efesto.forge",
          method: "POST",
          body: { goal: "Una afirmación o pregunta a investigar" },
          note: "El modelo no admite. El Kernel sí. Un paquete incompleto nunca es Completado.",
        }),
      POST: async ({ request }) => {
        let body: { goal?: unknown; agent?: unknown } = {};
        try {
          body = (await request.json()) as { goal?: unknown; agent?: unknown };
        } catch {
          body = {};
        }
        const result = await restForge(body.goal, {
          agent: typeof body.agent === "string" ? body.agent : undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
          header: request.headers.get("x-efesto-agent") ?? undefined,
        });
        return agentJson(result);
      },
    },
  },
});
